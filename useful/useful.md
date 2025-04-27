# Running the server
python -m http.server 8000

# Resetting to latest commit
git reset --hard HEAD && git clean -fdx

I want everything in my local machine to be exactly like the latest commit. Also, delete all untracked files. Then do nothing else.

# References
Next steps and notes - https://docs.google.com/document/d/1UA8CedW5Qqt_5u0W1OmUFJbgDPIfkMR_ZESPZVBEbvM/edit?tab=t.0

# Committing and pushing

1. Stage all changes (new, modified, deleted)
2. Commit the staged changes locally with a message
3. Push the local commits to the remote repository (usually origin/main)
git add -A && git commit -m "Organized useful files" && git push origin solving-js