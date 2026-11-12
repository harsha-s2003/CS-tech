@echo off
rem Starts the local test server for the CS TECH Ai website: http://localhost:8080/
rem (Apache + PHP from XAMPP, site at the root so clean URLs, redirects and the form work.)
rem Close this window to stop it.
if not exist "%~dp0logs" mkdir "%~dp0logs"
echo Local website: http://localhost:8080/
echo Close this window to stop the server.
"F:\xampp\apache\bin\httpd.exe" -f "%~dp0httpd.conf"
pause
