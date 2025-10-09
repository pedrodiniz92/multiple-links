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
git add -A && git commit -m "transcriber - GUI working alright, hamburger menu works" && git push origin main

# Project Filetree
```
multiple-links/
├── breaks.md
├── claude.md
├── completed-tasks/
│   ├── general.md
│   ├── reduce-app.js
│   ├── reduce-app.md
│   ├── reduce-plan.md
│   ├── reduce-progress.md
│   ├── reduce-to-do.md
│   └── reduce-what-to-test.txt
├── icons/
│   ├── backup-sun.svg
│   ├── floppy.svg
│   ├── folder.svg
│   ├── link.svg
│   ├── moon.svg
│   ├── new-file.svg
│   ├── pen.svg
│   └── sun.svg
├── index.html
├── js/
│   ├── app.js
│   ├── auth/
│   │   ├── auth-ui.js
│   │   ├── reset-password-modal.js
│   │   ├── signin-modal.js
│   │   └── signup-modal.js
│   ├── components/
│   │   ├── card-manager.js
│   │   ├── link-processor.js
│   │   └── panel-resizer.js
│   ├── data/
│   │   ├── storage.js
│   │   └── video-data.js
│   ├── editor/
│   │   ├── rich-editor.js
│   │   ├── spoiler-modal.js
│   │   └── youtube-modal.js
│   ├── services/
│   │   ├── auth-service.js
│   │   ├── url-service.js
│   │   ├── video-info.js
│   │   └── youtube-service.js
│   ├── ui/
│   │   ├── feedback.js
│   │   ├── responsive-ui.js
│   │   └── theme-manager.js
│   └── utils/
│       ├── html-utils.js
│       └── time-utils.js
├── next.md
├── plan.md
├── roadmap.md
├── spoiler-readme.md
├── styles.css
├── test/
│   ├── auth-mockup.html
│   ├── panel-resize-inspiration.js
│   ├── saved-lists.html
│   ├── timestamp-test.html
│   └── view-list.html
└── useful/
    ├── documents.md
    ├── readme.md
    └── useful.md
```