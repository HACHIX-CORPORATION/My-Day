# MyDay — EC2 Deployment via CloudFormation

This directory contains the AWS CloudFormation template that provisions a single
EC2 instance running the full MyDay MERN stack, including a local MongoDB 6.0
server. No external database service is required.

Deployments are automated via **GitHub Actions** — push to `main` and the code
is live within ~5 minutes. No SSH needed.

---

## Architecture Overview

```
Internet (port 80 / 443)
         │
 ┌───────▼──────────────────────────────────────────────┐
 │  EC2 t3.micro  (Amazon Linux 2)                      │
 │                                                      │
 │  Nginx :80/:443  ──proxy──►  Node.js :3030  (PM2)   │
 │                                    │                 │
 │  /home/ec2-user/app/               ▼                 │
 │    backend/          ←──►  MongoDB :27017 (local)    │
 │    backend/public/   ← React SPA (static build)      │
 └──────────────────────────────────────────────────────┘
         ▲
 GitHub Actions (push to main)
 → SSM Run Command → git fetch + reset + npm build + pm2 restart
```

- **Nginx** receives all traffic on port 80/443 and proxies it to `localhost:3030`,
  including the Socket.io WebSocket upgrade.
- **MongoDB 6.0** runs as a systemd service (`mongod`) bound to `127.0.0.1:27017`.
  Port 27017 is never opened in the security group — only Node.js can reach it from within the instance.
- **PM2** keeps Node.js running as a daemon and restarts it on crash and reboot.
- **Elastic IP** gives the instance a stable public address so DNS records survive
  instance restarts.
- **IAM Role + SSM** lets you open a terminal through AWS Systems Manager without
  needing port 22 or a key pair.
- **GitHub Actions + OIDC** — the workflow authenticates to AWS using short-lived
  OIDC tokens (no long-lived IAM credentials stored in GitHub secrets).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| AWS account | Free-tier works; `t2.micro` is eligible for 12 months |
| AWS CLI v2 | `aws --version` should show 2.x |
| EC2 key pair | Create in **EC2 → Key Pairs** if you want SSH access; optional otherwise |
| GitHub repo URL | HTTPS clone URL of this repository |
| SSM SecureString at `/myday/prod/secret1` | JWT/Cryptr signing key — pre-create before stack deploy (see Quick Deploy) |
| Google OAuth Client ID (optional) | Store in SSM at `/myday/prod/google_client_id` if using Google Login |

---

## Parameters Reference

| Parameter | Required | Default | Description |
|---|---|---|---|
| `KeyPairName` | No | `''` | EC2 key pair name for SSH. Leave empty to use SSM only. |
| `InstanceType` | No | `t3.micro` | EC2 type: `t3.micro`, `t3.small`, `t3.medium`, `t2.micro` |
| `MongoDBName` | No | `monday_DB` | MongoDB database name (local instance). |
| `SecretKeySSMPath` | No | `/myday/prod/secret1` | SSM path of the JWT/Cryptr SecureString. Pre-create the parameter first. |
| `GoogleClientIdSSMPath` | No | `/myday/prod/google_client_id` | SSM path of the Google OAuth Client ID. App starts without it if the parameter doesn't exist. |
| `GitHubRepoURL` | No | repo URL | HTTPS clone URL of this repository. |
| `GitBranch` | No | `main` | Branch to deploy. |
| `GitHubRepoOrg` | No | `HACHIX-CORPORATION/My-Day` | GitHub `Owner/Repo` for the OIDC trust condition. |

---

## Quick Deploy

### Option A — AWS Management Console

1. Pre-create the GitHub OIDC provider (one-time per AWS account — skip if it already exists):
   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```
2. Pre-create the JWT secret in SSM (via AWS CLI or CloudShell):
   ```bash
   aws ssm put-parameter \
     --name /myday/prod/secret1 \
     --type SecureString \
     --value "$(openssl rand -base64 32)"
   ```
3. Open **CloudFormation → Create stack → With new resources (standard)**.
4. Choose **Upload a template file** and upload `infras/cloudformation.yml`.
5. Set **Stack name** to `myday-prod`. Leave parameters at their defaults unless you need a custom branch or database name.
6. On the next screen check **I acknowledge that AWS CloudFormation might create IAM resources**.
7. Click **Submit** and wait for `CREATE_COMPLETE` (~40 minutes on t3.micro).
8. Open the **Outputs** tab and copy `AppURL`.

### Option B — AWS CLI

```bash
# 0. Pre-create secrets in SSM Parameter Store
aws ssm put-parameter \
  --name /myday/prod/secret1 \
  --type SecureString \
  --value "$(openssl rand -base64 32)"

# Optional — Google Login
aws ssm put-parameter \
  --name /myday/prod/google_client_id \
  --type String \
  --value "YOUR_GOOGLE_CLIENT_ID"

# 1. Validate first
aws cloudformation validate-template \
  --template-body file://infras/cloudformation.yml

# 2. Deploy
aws cloudformation deploy \
  --template-file infras/cloudformation.yml \
  --stack-name myday-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    MongoDBName="monday_DB" \
    GitHubRepoURL="https://github.com/HACHIX-CORPORATION/My-Day.git" \
    GitBranch="main" \
    GitHubRepoOrg="HACHIX-CORPORATION/My-Day"

# 3. Check outputs
aws cloudformation describe-stacks \
  --stack-name myday-prod \
  --query "Stacks[0].Outputs" \
  --output table
```

> **Note on the GitHub OIDC Provider:** Only one OIDC provider for
> `https://token.actions.githubusercontent.com` can exist per AWS account. The
> template creates it with `DeletionPolicy: Retain`. If you already have one,
> delete the `GitHubOIDCProvider` resource from the template and replace
> `!GetAtt GitHubOIDCProvider.Arn` with the existing provider ARN.
>
> Check: `aws iam list-open-id-connect-providers`

---

## GitHub Actions CI/CD Setup

One-time setup after the stack reaches `CREATE_COMPLETE`:

1. Get the GitHub Actions IAM Role ARN from CloudFormation outputs:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name myday-prod \
     --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue" \
     --output text
   ```

2. In the GitHub repository go to **Settings → Secrets and variables → Actions → Variables** (not Secrets — the role ARN is not sensitive) and add:

   | Variable | Value |
   |---|---|
   | `AWS_ROLE_ARN` | Role ARN from step 1 |
   | `AWS_REGION` | Region where the stack was deployed (e.g. `ap-southeast-1`) |
   | `STACK_NAME` | Stack name (e.g. `myday-prod`) |

3. Push any commit to `main` — the **Deploy to EC2** workflow runs automatically.

Monitor progress in **GitHub → Actions → Deploy to EC2**.

---

## Post-Deploy Checklist

Run these after `CREATE_COMPLETE` before sharing the URL.

### 1. Verify the app is responding

```bash
# Replace <IP> with the Elastic IP from the Outputs tab
curl -i http://<IP>/health          # expect: 200 OK, body: OK
curl -s http://<IP>/api/board       # expect: JSON array, not HTML
```

### 2. Check bootstrap logs inside the instance

```bash
# Connect via SSM (no key pair needed)
aws ssm start-session --target <INSTANCE_ID> --region <REGION>

# Inside the instance:
sudo tail -100 /var/log/user-data.log   # full bootstrap output
pm2 status                              # my-day should show "online"
pm2 logs my-day --lines 50             # application logs
```

### 3. Confirm MongoDB, PM2, and Nginx are healthy

```bash
systemctl status mongod          # should be: active (running)
mongosh --eval "db.adminCommand({ ping: 1 })"  # should print: ok: 1

pm2 status
systemctl status pm2-ec2-user    # should be: active (running)
systemctl status nginx           # should be: active (running)
nginx -t                         # config syntax check
```

### 4. Add the origin to Google Cloud Console

If you use Google Login, go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
and add `http://<ELASTIC_IP>` to **Authorized JavaScript origins** for your OAuth client.

---

## App Update Procedure

Code updates are deployed automatically via GitHub Actions when you push to `main`.

### Automatic (CI/CD — recommended)

Push to the `main` branch. The workflow in `.github/workflows/deploy.yml` will:
1. Authenticate with AWS via OIDC (no stored credentials)
2. Send a deployment command to the EC2 instance via AWS SSM
3. On EC2: `git fetch + reset --hard`, `npm ci`, `npm run build`, copy build, `pm2 restart --update-env`
4. Print stdout/stderr in the Actions UI if anything fails

Monitor in **GitHub → Actions → Deploy to EC2**. The workflow also supports manual triggers via **workflow_dispatch**.

### Manual (emergency or before CI/CD is configured)

```bash
# Connect via SSM
aws ssm start-session --target <INSTANCE_ID> --region <REGION>

# Inside the instance:
cd ~/app
sudo -u ec2-user git fetch origin main
sudo -u ec2-user git reset --hard origin/main
cd ~/app/frontend
sudo -u ec2-user npm ci && sudo -u ec2-user npm run build
rm -rf ~/app/backend/public/*
cp -r ~/app/frontend/build/. ~/app/backend/public/
cd ~/app/backend
sudo -u ec2-user npm ci
sudo -u ec2-user pm2 restart my-day --update-env
sudo -u ec2-user pm2 save
```

---

## SSH Access

Port 22 is not open in the security group — use SSM Session Manager instead.

### Using AWS Systems Manager (recommended — no key pair required)

Install the [Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html), then:

```bash
aws ssm start-session --target <INSTANCE_ID> --region <AWS_REGION>
```

Both `InstanceId` and the full `SSMCommand` are available in the CloudFormation **Outputs** tab.

### Using a key pair (optional)

If you deployed with `KeyPairName` set, you can add a port 22 ingress rule to the
security group and then SSH normally:
```bash
ssh -i ~/.ssh/<KeyPairName>.pem ec2-user@<ELASTIC_IP>
```

---

## MongoDB Management

MongoDB 6.0 runs as the `mongod` systemd service on `127.0.0.1:27017`.

### Connect with mongosh

```bash
mongosh                              # connects to localhost:27017 by default
mongosh monday_DB                    # open the app database directly
```

### Useful commands inside mongosh

```js
show dbs                             // list databases
use monday_DB                        // switch to app DB
show collections                     // list collections
db.users.find().pretty()             // inspect users
db.boards.countDocuments()           // count boards
```

### Service management

```bash
sudo systemctl stop mongod
sudo systemctl start mongod
sudo systemctl restart mongod
sudo journalctl -u mongod -n 100     # view mongod logs
```

### Backup and restore

```bash
# Backup the monday_DB database to ~/backups/
mongodump --db monday_DB --out ~/backups/$(date +%Y%m%d)

# Restore from a backup
mongorestore --db monday_DB ~/backups/<date>/monday_DB
```

> **Important:** MongoDB data lives at `/var/lib/mongo`. Deleting the CloudFormation
> stack also deletes the EBS volume and all data. Take a `mongodump` backup before
> any teardown or stack update that replaces the instance.

---

## Adding HTTPS

HTTPS is required for cookies with `SameSite=None; Secure` to work correctly in all browsers.

### Option A — Certbot / Let's Encrypt (requires a domain name)

```bash
sudo amazon-linux-extras install epel -y
sudo yum install -y certbot python-certbot-nginx

# Point your domain's A record to the Elastic IP first, then:
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
echo "0 3 * * * root certbot renew --quiet" | sudo tee -a /etc/crontab
```

### Option B — ACM + Application Load Balancer (recommended for production)

1. Request a free TLS certificate in **AWS Certificate Manager (ACM)**.
2. Create an **Application Load Balancer** with an HTTPS listener on port 443
   forwarding to the EC2 instance on port 80.
3. Update the security group to allow port 80 only from the ALB's security group
   (remove the public `0.0.0.0/0` rule on port 80).

---

## Environment Variables Reference

Written to `/home/ec2-user/.env` (mode 600) during bootstrap. Fetched from SSM at boot time — never embedded in the template or UserData.

| Variable | Source | Description |
|---|---|---|
| `NODE_ENV` | Template | Always `production` |
| `PORT` | Template | Node.js listening port (`3030`) |
| `MONGODB_URI` | Template | `mongodb://localhost:27017` (local MongoDB) |
| `MONGODB_DB_NAME` | `MongoDBName` parameter | Database name (default `monday_DB`) |
| `SECRET1` | SSM: `/myday/prod/secret1` | Cryptr / JWT encryption key |
| `GOOGLE_CLIENT_ID` | SSM: `/myday/prod/google_client_id` | Google OAuth client ID (optional) |

To update a variable after deployment without redeploying the stack:

```bash
# Update the SSM parameter
aws ssm put-parameter \
  --name /myday/prod/secret1 \
  --type SecureString \
  --value "NEW_VALUE" \
  --overwrite

# Then either push a commit to trigger CI/CD, or manually:
aws ssm start-session --target <INSTANCE_ID> --region <REGION>
# Inside:
nano /home/ec2-user/.env
pm2 restart my-day --update-env
pm2 save
```

---

## Troubleshooting

| Symptom | Where to look | Likely cause |
|---|---|---|
| Stack stuck at `CREATE_IN_PROGRESS` > 25 min | CloudFormation → Events tab | UserData error — check `/var/log/user-data.log` |
| `502 Bad Gateway` in browser | `pm2 logs my-day` | Node.js crashed; check app error log |
| DB connection errors in logs | `sudo journalctl -u mongod -n 50` | `mongod` not running; try `sudo systemctl start mongod` |
| App loads but data is missing | PM2 logs | `MONGODB_DB_NAME` mismatch or empty DB (expected if freshly deployed) |
| Google Login fails | Browser console | Origin not in Google Cloud Console whitelist |
| Cookies not set after login | Browser dev tools | HTTP without HTTPS — browser blocks `SameSite=None` |
| Frontend shows blank page | Nginx error log + PM2 | Build not copied to `backend/public/` |
| `pm2: command not found` | — | Run: `export PATH=$PATH:$(npm root -g)/.bin` |
| `mongosh: command not found` | — | MongoDB tools are in `/usr/bin/mongosh`; run with full path |
| GitHub Actions: `AccessDenied` on `sts:AssumeRoleWithWebIdentity` | Actions log | OIDC provider ARN or trust condition mismatch — verify `GitHubRepoOrg` parameter |
| GitHub Actions: `InvalidInstanceId` | Actions log | `STACK_NAME` variable wrong, or instance was replaced by a stack update |
| Bootstrap error: `ParameterNotFound` | `/var/log/user-data.log` | SSM parameter not pre-created before stack deploy |

---

## Stack Teardown

> **Warning:** Deleting the stack terminates the EC2 instance and **permanently
> deletes the EBS volume and all MongoDB data**. Run `mongodump` before teardown
> if you need to preserve the data.
>
> The `GitHubOIDCProvider` resource has `DeletionPolicy: Retain` — it will **not**
> be deleted with the stack (to avoid breaking other stacks that may share it).

```bash
aws cloudformation delete-stack --stack-name myday-prod

# Monitor
aws cloudformation describe-stacks \
  --stack-name myday-prod \
  --query "Stacks[0].StackStatus"
```

Or in the Console: **CloudFormation → Stacks → myday-prod → Delete**.

---

## Cost Estimate

Approximate monthly costs (us-east-1 / ap-southeast-1, on-demand pricing):

| Resource | Cost/month |
|---|---|
| EC2 t3.micro | ~$8.50 USD |
| EC2 t2.micro (free tier, first 12 months) | $0 |
| Elastic IP (while attached to running instance) | Free |
| EBS gp3 30 GB (app + MongoDB data) | ~$2.40 USD |
| Data transfer — first 100 GB out | Free tier |
| **Total (after free tier)** | **~$11 USD/month** |
