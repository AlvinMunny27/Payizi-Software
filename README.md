# Payizi-Software
Automation Project

[![Deploy to Cloudflare Pages](https://github.com/AlvinMunny27/Payizi-Software/actions/workflows/cloudflare-pages.yml/badge.svg)](https://github.com/AlvinMunny27/Payizi-Software/actions/workflows/cloudflare-pages.yml)

## 🚀 Deployment

This project is deployed on multiple platforms for redundancy and accessibility:

- **Primary (Cloudflare Pages)**: [https://payizi-software.pages.dev](https://payizi-software.pages.dev)
- **Backup (Netlify)**: Available as fallback option

### Migration Notice

We've migrated to Cloudflare Pages as the primary deployment platform due to ISP-level blocking issues affecting some users accessing the Netlify deployment. The Netlify deployment remains active as a backup option.

**Why Cloudflare Pages?**
- Better global accessibility (bypasses regional ISP blocks)
- Improved reliability for users experiencing connectivity issues
- Fast CDN with excellent uptime
- Works without VPN for all users

## 📋 About

Payizi-Software is a static website project featuring:
- Custom order management system
- Contact forms
- Status tracking
- Responsive design
- Pure HTML, CSS, and JavaScript (no build process required)

## 🛠️ Setup for Cloudflare Pages Deployment

### Prerequisites
- GitHub repository with this code
- Cloudflare account (free tier works)
- Cloudflare API credentials

### Step 1: Create Cloudflare Pages Project

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **Workers & Pages** > **Create application** > **Pages**
3. Connect your GitHub account
4. Select the `AlvinMunny27/Payizi-Software` repository
5. Configure the build settings:
   - **Project name**: `payizi-software`
   - **Production branch**: `main`
   - **Build command**: (leave empty)
   - **Build output directory**: `/` or `.`
6. Click **Save and Deploy**

### Step 2: Get Cloudflare API Credentials

#### Option A: Using Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **My Profile** > **API Tokens**
3. Click **Create Token**
4. Use the **Edit Cloudflare Workers** template or create a custom token with:
   - Permissions: `Cloudflare Pages:Edit`
   - Account Resources: `Include` > `Your Account`
5. Click **Continue to summary** > **Create Token**
6. Copy the token (you won't see it again!)

#### Option B: Using Account ID

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. The **Account ID** is visible on the right side of the overview page
4. Copy the Account ID

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository: `https://github.com/AlvinMunny27/Payizi-Software`
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add:
   - **Name**: `CLOUDFLARE_API_TOKEN`
   - **Value**: Your API token from Step 2
4. Click **Add secret**
5. Add another secret:
   - **Name**: `CLOUDFLARE_ACCOUNT_ID`
   - **Value**: Your Account ID from Step 2
6. Click **Add secret**

### Step 4: Trigger Deployment

The GitHub Actions workflow will automatically deploy on every push to the `main` branch.

To manually trigger:
1. Go to **Actions** tab in your repository
2. Select **Deploy to Cloudflare Pages** workflow
3. Click **Run workflow** > **Run workflow**

## 🔍 Monitoring Deployments

- **GitHub Actions**: Check deployment status at `https://github.com/AlvinMunny27/Payizi-Software/actions`
- **Cloudflare Dashboard**: View deployment logs at `https://dash.cloudflare.com/` > **Workers & Pages** > **payizi-software**

## 🐛 Troubleshooting

### Deployment Fails with "Invalid API Token"
- Verify that `CLOUDFLARE_API_TOKEN` is correctly set in GitHub Secrets
- Ensure the API token has `Cloudflare Pages:Edit` permission
- Check if the token has expired and generate a new one if needed

### Deployment Fails with "Invalid Account ID"
- Verify that `CLOUDFLARE_ACCOUNT_ID` is correctly set in GitHub Secrets
- Ensure you copied the Account ID from your Cloudflare dashboard
- Account ID should be a 32-character hexadecimal string

### GitHub Action Doesn't Trigger
- Ensure the workflow file is in `.github/workflows/cloudflare-pages.yml`
- Check that you're pushing to the `main` branch
- Verify Actions are enabled in repository settings

### Site Deploys But Shows 404 Errors
- Ensure `directory: .` is set in the workflow (deploys from root)
- Check that all HTML files are in the root directory
- Verify file names are correct (index.html, contact.html, status.html)

### Assets Not Loading (CSS/JS/Images)
- Check that file paths are relative (e.g., `style.css` not `/style.css`)
- Verify all asset files are committed to the repository
- Check browser console for specific 404 errors

### Site Works on Netlify But Not Cloudflare
- Both platforms handle static sites identically
- Check Cloudflare Pages build logs for any errors
- Ensure no hardcoded Netlify URLs in the code

## 📁 Project Structure

```
Payizi-Software/
├── .github/
│   └── workflows/
│       └── cloudflare-pages.yml    # GitHub Actions workflow
├── index.html                       # Homepage
├── contact.html                     # Contact page
├── status.html                      # Status page
├── style.css                        # Styles
├── script.js                        # Main JavaScript
├── order.js                         # Order management
├── status.js                        # Status tracking
├── google-apps-script.js            # Google Apps integration
├── email-diagnostic-functions.js   # Email diagnostics
├── test-mobile-cleaning.js         # Mobile testing
├── white_icon_transparent_background.png  # Logo
├── wrangler.toml                   # Cloudflare configuration
└── netlify.toml                    # Netlify configuration (backup)
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally by opening HTML files in a browser
5. Submit a pull request

## 📄 License

This project is maintained by AlvinMunny27.

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review [Cloudflare Pages documentation](https://developers.cloudflare.com/pages/)
3. Check GitHub Actions logs for deployment errors
4. Open an issue in this repository
