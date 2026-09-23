$ErrorActionPreference = 'Stop'
$inputPath = 'C:\Users\okdan\Documents\ChatGPT\Guardian\docs\Guardian_Customer_Validation_Tracker.docx'
$outputPath = 'C:\Users\okdan\Documents\ChatGPT\Guardian\.codex-tmp\customer-validation-render\Guardian_Customer_Validation_Tracker.pdf'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputPath) | Out-Null

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($inputPath, $false, $true)
    $document.ExportAsFixedFormat($outputPath, 17)
}
finally {
    if ($null -ne $document) {
        $document.Close($false)
    }
    if ($null -ne $word) {
        $word.Quit()
    }
}

Write-Output $outputPath
