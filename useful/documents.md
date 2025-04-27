## Document controls

# Download everything
zip -r project_archive.zip . -x ".git/*" -x "node_modules/*"

## Generate Filetree
Generate the filetree for my entire project using box drawing characters (├──, │, └──) and add it to the end of /useful-md/useful.md

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