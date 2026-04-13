$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

function Get-DotEnvMap {
  param(
    [string]$EnvPath
  )

  $map = @{}
  if (-not (Test-Path -LiteralPath $EnvPath)) {
    return $map
  }

  foreach ($rawLine in Get-Content -LiteralPath $EnvPath) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -le 0) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    if (-not $key) {
      continue
    }

    $value = $line.Substring($separatorIndex + 1).Trim()
    $hasMatchingQuotes =
      (($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'")))
    if ($hasMatchingQuotes -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $map[$key] = $value
  }

  return $map
}

function Add-OptionalDeployFile {
  param(
    [hashtable]$EnvValues,
    [string]$SourcePathKey,
    [string]$DeployFileNameKey,
    [string]$DefaultDeployFileName,
    [string]$Label,
    [string]$StageDir
  )

  $sourcePath = ""
  if ($EnvValues.ContainsKey($SourcePathKey)) {
    $sourcePath = [string]$EnvValues[$SourcePathKey]
  }

  if (-not $sourcePath) {
    return $null
  }

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    Write-Warning "$SourcePathKey configurado, mas o arquivo nao foi encontrado em $sourcePath"
    return $null
  }

  $deployFileName = ""
  if ($DeployFileNameKey -and $EnvValues.ContainsKey($DeployFileNameKey)) {
    $deployFileName = [string]$EnvValues[$DeployFileNameKey]
  }

  if (-not $deployFileName) {
    $deployFileName = $DefaultDeployFileName
  }

  if (-not $deployFileName) {
    $deployFileName = Split-Path -Path $sourcePath -Leaf
  }

  Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $StageDir $deployFileName) -Force
  return $deployFileName
}

function Write-DeployDotEnv {
  param(
    [hashtable]$EnvValues,
    [hashtable]$CopiedFileMap,
    [string]$StageDir
  )

  $deployEnv = @{}
  foreach ($key in $EnvValues.Keys) {
    $deployEnv[$key] = [string]$EnvValues[$key]
  }

  $deployEnv["NODE_ENV"] = "production"

  $pathKeys = @(
    "EFI_CERT_P12_PATH",
    "EFI_CA_PATH",
    "DATABASE_SSL_CA_PATH",
    "DATABASE_SSL_CERT_PATH",
    "DATABASE_SSL_KEY_PATH"
  )

  foreach ($pathKey in $pathKeys) {
    if ($deployEnv.ContainsKey($pathKey)) {
      $deployEnv.Remove($pathKey) | Out-Null
    }
  }

  foreach ($entry in $CopiedFileMap.GetEnumerator()) {
    if (-not $entry.Value) {
      continue
    }
    $deployEnv[$entry.Key] = "/home/container/$($entry.Value)"
  }

  $lines = @()
  foreach ($key in ($deployEnv.Keys | Sort-Object)) {
    $value = [string]$deployEnv[$key]
    $lines += "$key=$value"
  }

  $envPath = Join-Path $StageDir ".env"
  [System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.Encoding]::UTF8)
}

function Copy-RuntimeArtifactsForDeploy {
  param(
    [string]$WorkspaceRoot,
    [string]$StageDir,
    [hashtable]$EnvValues
  )

  $sourceRoot = Join-Path $WorkspaceRoot "runtime-artifacts"
  if (-not (Test-Path -LiteralPath $sourceRoot)) {
    return
  }

  $targetRoot = Join-Path $StageDir "runtime-artifacts"
  New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null

  $readmePath = Join-Path $sourceRoot "README.md"
  if (Test-Path -LiteralPath $readmePath) {
    Copy-Item -LiteralPath $readmePath -Destination (Join-Path $targetRoot "README.md") -Force
  }

  $generatedSourceDir = Join-Path $sourceRoot "generated"
  if (-not (Test-Path -LiteralPath $generatedSourceDir)) {
    return
  }

  $generatedTargetDir = Join-Path $targetRoot "generated"
  New-Item -ItemType Directory -Path $generatedTargetDir -Force | Out-Null

  $instanceScopedArtifactPattern = '-[0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12}\.zip$'
  $artifactFiles = Get-ChildItem -LiteralPath $generatedSourceDir -File | Where-Object {
    $_.Name -notmatch $instanceScopedArtifactPattern
  }

  foreach ($artifactFile in $artifactFiles) {
    if ($artifactFile.Name -ieq "bot-ticket-hype.zip" -and $EnvValues.ContainsKey("SOURCE_GITHUB_REPO_BOT_TICKET_HYPE")) {
      continue
    }

    Copy-Item -LiteralPath $artifactFile.FullName -Destination (Join-Path $generatedTargetDir $artifactFile.Name) -Force
  }
}

$prepareScript = Join-Path $workspaceRoot "scripts\prepare-production-artifacts.js"
if (Test-Path -LiteralPath $prepareScript) {
  node $prepareScript
}

$deployDir = Join-Path $workspaceRoot "deploy"
$zipPath = Join-Path $deployDir "bot-manager-squarecloud.zip"
$stageDir = Join-Path $deployDir "_package-root"

if (-not (Test-Path -LiteralPath $deployDir)) {
  New-Item -ItemType Directory -Path $deployDir | Out-Null
}

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

if (Test-Path -LiteralPath $stageDir) {
  Remove-Item -LiteralPath $stageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stageDir | Out-Null

try {
  $envValues = Get-DotEnvMap (Join-Path $workspaceRoot ".env")

  $items = @(
    "dist",
    "data",
    "runtime-artifacts",
    "package.json",
    "package-lock.json",
    "squarecloud.app",
    ".env.squarecloud.example"
  ) | Where-Object { Test-Path -LiteralPath $_ }

  if ($items.Count -eq 0) {
    throw "Nenhum arquivo de deploy foi encontrado para empacotar."
  }

  foreach ($item in $items) {
    if ($item -eq "runtime-artifacts") {
      Copy-RuntimeArtifactsForDeploy -WorkspaceRoot $workspaceRoot -StageDir $stageDir -EnvValues $envValues
      continue
    }

    $destination = Join-Path $stageDir (Split-Path -Path $item -Leaf)
    Copy-Item -LiteralPath $item -Destination $destination -Recurse -Force
  }

  $copiedFileMap = @{
    "EFI_CERT_P12_PATH" = Add-OptionalDeployFile -EnvValues $envValues -SourcePathKey "EFI_CERT_P12_PATH" -DeployFileNameKey "EFI_CERT_P12_DEPLOY_FILENAME" -DefaultDeployFileName "efi-cert.p12" -Label "Certificado EFI" -StageDir $stageDir
    "EFI_CA_PATH" = Add-OptionalDeployFile -EnvValues $envValues -SourcePathKey "EFI_CA_PATH" -DeployFileNameKey "EFI_CA_DEPLOY_FILENAME" -DefaultDeployFileName "" -Label "Arquivo CA da EFI" -StageDir $stageDir
    "DATABASE_SSL_CA_PATH" = Add-OptionalDeployFile -EnvValues $envValues -SourcePathKey "DATABASE_SSL_CA_PATH" -DeployFileNameKey "DATABASE_SSL_CA_DEPLOY_FILENAME" -DefaultDeployFileName "database-ca.crt" -Label "CA do banco" -StageDir $stageDir
    "DATABASE_SSL_CERT_PATH" = Add-OptionalDeployFile -EnvValues $envValues -SourcePathKey "DATABASE_SSL_CERT_PATH" -DeployFileNameKey "DATABASE_SSL_CERT_DEPLOY_FILENAME" -DefaultDeployFileName "database-client.pem" -Label "Certificado do banco" -StageDir $stageDir
    "DATABASE_SSL_KEY_PATH" = Add-OptionalDeployFile -EnvValues $envValues -SourcePathKey "DATABASE_SSL_KEY_PATH" -DeployFileNameKey "DATABASE_SSL_KEY_DEPLOY_FILENAME" -DefaultDeployFileName "database-client.key" -Label "Chave privada do banco" -StageDir $stageDir
  }

  Write-DeployDotEnv -EnvValues $envValues -CopiedFileMap $copiedFileMap -StageDir $stageDir

  $stageItems = Get-ChildItem -LiteralPath $stageDir | ForEach-Object { $_.FullName }
  if ($stageItems.Count -eq 0) {
    throw "Nenhum arquivo staged foi encontrado para empacotar."
  }

  Compress-Archive -Path $stageItems -DestinationPath $zipPath -CompressionLevel Optimal
  Write-Output "Pacote gerado em: $zipPath"
}
finally {
  if (Test-Path -LiteralPath $stageDir) {
    Remove-Item -LiteralPath $stageDir -Recurse -Force
  }
}
