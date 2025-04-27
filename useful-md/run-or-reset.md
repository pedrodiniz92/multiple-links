# Running the server
python -m http.server 8000

# Resetting to latest commit
git reset --hard HEAD && git clean -fdx

I want everything in my local machine to be exactly like the latest commit. Also, delete all untracked files. Then do nothing else.

# References
Next steps and notes - https://docs.google.com/document/d/1UA8CedW5Qqt_5u0W1OmUFJbgDPIfkMR_ZESPZVBEbvM/edit?tab=t.0


# Filetree
```
/workspaces/multiple-links/
├── .env
├── .env.example
├── claude.md
├── completed-tasks/
│   ├── reduce-app.js
│   ├── reduce-app.md
│   ├── reduce-plan.md
│   ├── reduce-progress.md
│   ├── reduce-to-do.md
│   └── reduce-what-to-test.txt
├── firebase-service-account.json
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
│   ├── components/
│   │   ├── card-manager.js
│   │   ├── link-processor.js
│   │   └── panel-resizer.js
│   ├── data/
│   │   ├── storage.js
│   │   └── video-data.js
│   ├── editor/
│   │   ├── rich-editor.js
│   │   └── youtube-modal.js
│   ├── services/
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
├── roadmap.md
├── styles.css
├── test/
│   ├── auth-mockup.html
│   ├── panel-resize-inspiration.js
│   ├── saved-lists.html
│   ├── signin.html
│   ├── signup.html
│   ├── timestamp-test.html
│   └── view-list.html
├── text-to-speech-457017-260ac9cc74bf.json
└── useful-md/
    ├── readme.md
    └── run-or-reset.md
```