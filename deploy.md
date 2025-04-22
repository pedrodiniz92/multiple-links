# Deploying Your YouTube Viewer Website Using GitHub Pages

GitHub Pages is a free hosting service that allows you to publish your static website directly from your GitHub repository. Here's how you can deploy the YouTube Viewer website:

## Step 1: Push Your Code to GitHub

1. Create a new repository on GitHub
   - Go to [github.com](https://github.com) and sign in
   - Click the "+" icon in the top right and select "New repository"
   - Name your repository (e.g., "youtube-viewer")
   - Choose whether to make it public or private
   - Click "Create repository"

2. Initialize Git and push your code:
   ```bash
   # If not already a Git repository
   git init
   
   # Add your files
   git add .
   
   # Commit the files
   git commit -m "Initial commit"
   
   # Add remote repository (replace with your actual repository URL)
   git remote add origin https://github.com/yourusername/youtube-viewer.git
   
   # Push to GitHub
   git push -u origin main
   ```

## Step 2: Configure GitHub Pages

1. Go to your repository on GitHub

2. Click on "Settings" tab

3. Scroll down to the "GitHub Pages" section (or click on "Pages" in the left sidebar)

4. Under "Source", select the branch you want to deploy (usually "main" or "master")

5. Select the root folder ("/") as your publishing source

6. Click "Save"

7. GitHub will provide you with a URL where your site is published (usually in the format: `https://yourusername.github.io/youtube-viewer/`)

## Step 3: Verify Your Deployment

1. Wait a few minutes for GitHub Pages to build and deploy your site

2. Visit the provided URL to see your live website

3. Test the functionality to ensure everything works as expected

## Additional Options

### Custom Domain (Optional)

If you want to use a custom domain instead of the default github.io domain:

1. Purchase a domain from a domain registrar (like Namecheap, GoDaddy, etc.)

2. In your repository's GitHub Pages settings, under "Custom domain", enter your domain name

3. Configure your domain's DNS settings with your registrar:
   - For an apex domain (example.com), set up A records pointing to GitHub's IP addresses
   - For a subdomain (www.example.com), set up a CNAME record pointing to your github.io URL

### Troubleshooting

If your site doesn't appear or functions incorrectly:

1. Check for any errors in the GitHub Pages build process (visible in the Pages section of Settings)

2. Ensure all resource paths are relative, not absolute

3. Check if there are any CORS issues with the YouTube API calls (these might behave differently on GitHub Pages)

## Maintaining Your Site

When you want to make updates to your site:

1. Make changes to your local files

2. Commit and push the changes to GitHub:
   ```bash
   git add .
   git commit -m "Updated website with new features"
   git push
   ```

3. GitHub Pages will automatically rebuild and update your site

That's it! Your YouTube Viewer website is now live and accessible to anyone with the URL.