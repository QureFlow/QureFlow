param([Parameter(Mandatory=$true)][string]$Docx,[Parameter(Mandatory=$true)][string]$Pdf,[switch]$Update)
$ErrorActionPreference = 'Stop'
$Docx = [IO.Path]::GetFullPath($Docx).Replace('/','\')
$Pdf = [IO.Path]::GetFullPath($Pdf).Replace('/','\')
$app = $null
$document = $null
$stagedDocx = Join-Path ([IO.Path]::GetDirectoryName($Docx)) ('word-export-' + [guid]::NewGuid().ToString() + '.docx')
try {
  $app = New-Object -ComObject Word.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  $app.AutomationSecurity = 3
  $openReadOnly = [bool](-not $Update.IsPresent)
  $document = $app.Documents.Open($Docx,$false,$openReadOnly,$false)
  if ($Update) {
    $document.Fields.Update() | Out-Null
    foreach ($toc in $document.TablesOfContents) { $toc.Update() }
    $document.Repaginate()
    foreach ($toc in $document.TablesOfContents) { $toc.UpdatePageNumbers() }
    $document.Save()
  }
  $document.ExportAsFixedFormat($Pdf,17)
  Write-Output ('Word exported ' + $document.ComputeStatistics(2) + ' pages.')
} finally {
  if ($document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
  if ($app) { $app.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
