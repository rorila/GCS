$results = Select-String -Path 'src/components/*.ts' -Pattern 'ComponentStyle' -List
$results | ForEach-Object { $_.Path }
Write-Host "---"
# TWindow Update-Method Suche
Select-String -Path 'src/components/TWindow.ts' -Pattern 'updateDOM|element|public\s+render|protected\s+render' | Select-Object -First 10 | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
