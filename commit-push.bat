@echo off
chcp 65001 >nul
git add .
git commit -m "Add Documents to Finance Transactions linking feature - Migration, API routes, server actions, suggestion engine and UI components"
git push
pause

