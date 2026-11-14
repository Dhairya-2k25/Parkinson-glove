# Script to copy backend, data_importer, and supabase from frontend/ to Parkinson/ root
Write-Host "Copying project modules to root folder..." -ForegroundColor Cyan

$dest = ".."
Copy-Item -Path "backend" -Destination "$dest\backend" -Recurse -Force
Copy-Item -Path "data_importer" -Destination "$dest\data_importer" -Recurse -Force
Copy-Item -Path "supabase" -Destination "$dest\supabase" -Recurse -Force

Write-Host "Done! backend, data_importer, and supabase copied to $dest" -ForegroundColor Green
