param(
    [string]$Message = ""
)

git status

if ($Message -eq "") {
    $Message = Read-Host "Message de commit"
}

if ($Message -eq "") {
    Write-Host "Message vide, annulation." -ForegroundColor Red
    exit 1
}

git add .
git commit -m $Message
git push

