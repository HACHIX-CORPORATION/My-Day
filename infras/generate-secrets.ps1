# generate-secrets.ps1
# Generates a random SecretKey and (optionally) an EC2 Key Pair for MyDay deployment.

param(
    [string]$KeyPairName = "myday-key",
    [string]$KeyOutputDir = "$HOME\.ssh",
    [switch]$SkipKeyPair
)

# ── SecretKey ────────────────────────────────────────────────────────────────
$bytes = New-Object byte[] 32
[Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
$secretKey = [Convert]::ToBase64String($bytes)

Write-Host ""
Write-Host "=== SecretKey ===" -ForegroundColor Cyan
Write-Host $secretKey -ForegroundColor Yellow
Write-Host "(copy this value into the SecretKey parameter when deploying)" -ForegroundColor DarkGray

# ── EC2 Key Pair ─────────────────────────────────────────────────────────────
if (-not $SkipKeyPair) {
    Write-Host ""
    Write-Host "=== EC2 Key Pair ===" -ForegroundColor Cyan

    # Check AWS CLI is available
    if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
        Write-Warning "AWS CLI not found. Install it from https://aws.amazon.com/cli/ then re-run this script."
        Write-Warning "Skipping key pair creation. Use -SkipKeyPair to suppress this warning."
    } else {
        # Check if key pair already exists
        $existing = aws ec2 describe-key-pairs --key-names $KeyPairName --query "KeyPairs[0].KeyName" --output text 2>$null
        if ($existing -eq $KeyPairName) {
            Write-Warning "Key pair '$KeyPairName' already exists in AWS. Using the existing name."
            Write-Host "KeyPairName: $KeyPairName" -ForegroundColor Yellow
        } else {
            # Create output directory if needed
            if (-not (Test-Path $KeyOutputDir)) {
                New-Item -ItemType Directory -Path $KeyOutputDir | Out-Null
            }

            $pemPath = Join-Path $KeyOutputDir "$KeyPairName.pem"

            Write-Host "Creating key pair '$KeyPairName' ..."
            aws ec2 create-key-pair `
                --key-name $KeyPairName `
                --query "KeyMaterial" `
                --output text | Out-File -FilePath $pemPath -Encoding ascii -NoNewline

            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to create key pair. Check your AWS credentials and region."
            } else {
                Write-Host "Key pair created." -ForegroundColor Green
                Write-Host "PEM file saved to: $pemPath" -ForegroundColor Yellow
                Write-Host "KeyPairName:       $KeyPairName" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "SSH command after deploy:" -ForegroundColor DarkGray
                Write-Host "  ssh -i `"$pemPath`" ec2-user@<ELASTIC_IP>" -ForegroundColor DarkGray
            }
        }
    }
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== CloudFormation deploy command ===" -ForegroundColor Cyan
Write-Host @"
aws cloudformation deploy ``
  --template-file infras/cloudformation.yml ``
  --stack-name myday-prod ``
  --capabilities CAPABILITY_NAMED_IAM ``
  --parameter-overrides ``
    SecretKey="$secretKey" ``
    KeyPairName="$KeyPairName" ``
    MongoDBName="monday_DB" ``
    GitHubRepoURL="https://github.com/idandavid1/sprint-4.git" ``
    GitBranch="main"
"@ -ForegroundColor DarkGray
