#Requires -Version 5.1
<#
    Builds the Powerbind system design diagram.

    Outputs
      system-design.svg  self-contained: the brand icons are embedded as
                         <symbol> paths, so the file renders anywhere offline.
      system-design.jpg  raster export at 2x, for documents and slides.

    Pipeline
      system-design.svg -> headless Chrome screenshot (PNG) -> JPEG (System.Drawing)

    Run
      powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
#>
[CmdletBinding()]
param([switch]$KeepPng)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$here    = $PSScriptRoot
$cache   = Join-Path $here '.icon-cache'
$svgPath = Join-Path $here 'system-design.svg'
$pngPath = Join-Path $here 'system-design.png'
$jpgPath = Join-Path $here 'system-design.jpg'

$W = 1920
$H = 1180
$SCALE = 2

# Palette taken from the frontend source: #0f8cd5 is by far the most used
# accent, with #ececbb / #d5e2de / #7adaa5 / #f97316 as the supporting tones.
$C = @{
    bg      = '#f0f2f5'
    card    = '#ffffff'
    cardAlt = '#fbfcfd'
    line    = '#dbe2ea'
    ink     = '#1e293b'
    muted   = '#64748b'
    faint   = '#94a3b8'
    brand   = '#0f8cd5'
    lime    = '#ececbb'
    green   = '#7adaa5'
    orange  = '#f97316'
    sage    = '#d5e2de'
    red     = '#ef4444'
    dark    = '#2c3235'
}

$FONT = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif"
$MONO = "Consolas, 'Cascadia Mono', monospace"

# Simple Icons slugs. Any that is missing locally is downloaded on first run and
# embedded into the SVG as a <symbol>, so the diagram never links to the web.
$ICONS = @(
    'espressif', 'eclipsemosquitto', 'springboot', 'postgresql', 'influxdb',
    'redis', 'vuedotjs', 'vite', 'pinia', 'tailwindcss', 'axios',
    'jsonwebtokens', 'flyway', 'hibernate', 'grafana', 'prometheus', 'openjdk'
)

function Get-IconFile {
    param([string]$Slug)
    $file = Join-Path $cache "$Slug.svg"
    if (-not (Test-Path -LiteralPath $file)) {
        $ProgressPreference = 'SilentlyContinue'
        New-Item -ItemType Directory -Path $cache -Force | Out-Null
        Invoke-WebRequest -UseBasicParsing -Uri "https://cdn.simpleicons.org/$Slug" -OutFile $file
    }
    return $file
}

function Get-IconDefs {
    $defs = New-Object System.Collections.ArrayList
    foreach ($slug in $ICONS) {
        $raw = [System.IO.File]::ReadAllText((Get-IconFile $slug))
        $match = [regex]::Match($raw, '<path d="([^"]+)"')
        if (-not $match.Success) { throw "no <path d> found in the $slug icon" }
        [void]$defs.Add("    <symbol id=""ic-$slug"" viewBox=""0 0 24 24""><path d=""$($match.Groups[1].Value)""/></symbol>")
    }
    return ($defs -join "`n")
}

function Esc {
    param([string]$Text)
    return ($Text -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
}

# ------------------------------------------------------------- primitives

function New-Icon {
    param([string]$Slug, [int]$X, [int]$Y, [int]$Size, [string]$Fill)
    return "<use href=""#ic-$Slug"" x=""$X"" y=""$Y"" width=""$Size"" height=""$Size"" fill=""$Fill""/>"
}

# Rounded monogram badge, used for the few brands Simple Icons does not ship
# (Groq, Loki) and for own concepts.
function New-Mono {
    param([string]$Text, [int]$X, [int]$Y, [int]$Size, [string]$Fill, [string]$Ink = '#ffffff')
    $r = [int]($Size * 0.24)
    $fs = [int]($Size * 0.5)
    $cx = $X + [int]($Size / 2)
    $cy = $Y + [int]($Size * 0.5) + [int]($fs * 0.36)
    return "<rect x=""$X"" y=""$Y"" width=""$Size"" height=""$Size"" rx=""$r"" fill=""$Fill""/><text x=""$cx"" y=""$cy"" font-family=""$FONT"" font-size=""$fs"" font-weight=""700"" fill=""$Ink"" text-anchor=""middle"">$Text</text>"
}

# Text runs that look too wide for their card are collected here and reported
# once the file is written: a script cannot look at the picture, so it estimates.
$script:Overflow = New-Object System.Collections.ArrayList

function New-Card {
    param(
        [int]$X, [int]$Y, [int]$W, [int]$H,
        [string]$Title,
        [string[]]$Lines = @(),
        [string]$Icon = '', [string]$Mono = '',
        [string]$Accent = '#0f8cd5',
        [string]$Badge = '',
        [string]$IconFill = ''
    )
    if (-not $IconFill) { $IconFill = $Accent }
    $s = New-Object System.Collections.ArrayList
    [void]$s.Add("  <rect x=""$X"" y=""$Y"" width=""$W"" height=""$H"" rx=""12"" fill=""$($C.card)"" stroke=""$($C.line)""/>")
    [void]$s.Add("  <rect x=""$X"" y=""$Y"" width=""6"" height=""$H"" rx=""3"" fill=""$Accent""/>")
    if ($Icon) { [void]$s.Add('  ' + (New-Icon $Icon ($X + 18) ($Y + 16) 30 $IconFill)) }
    elseif ($Mono) { [void]$s.Add('  ' + (New-Mono $Mono ($X + 18) ($Y + 16) 30 $Accent)) }

    $titleX = $X + 20
    if ($Icon -or $Mono) { $titleX = $X + 60 }

    $bw = 0
    if ($Badge) { $bw = [int]($Badge.Length * 7.4) + 18 }
    $titleRoom = $W - ($titleX - $X) - $bw - 16
    if ([int]($Title.Length * 9.2) -gt $titleRoom) {
        [void]$script:Overflow.Add(('title in a {0} px card (room {1} px): {2}' -f $W, $titleRoom, $Title))
    }
    [void]$s.Add("  <text x=""$titleX"" y=""$($Y + 36)"" font-family=""$FONT"" font-size=""16"" font-weight=""700"" fill=""$($C.ink)"">$(Esc $Title)</text>")

    if ($Badge) {
        $bx = $X + $W - $bw - 14
        [void]$s.Add("  <rect x=""$bx"" y=""$($Y + 15)"" width=""$bw"" height=""22"" rx=""11"" fill=""$($C.brand)""/>")
        [void]$s.Add("  <text x=""$($bx + [int]($bw / 2))"" y=""$($Y + 30)"" font-family=""$MONO"" font-size=""11.5"" font-weight=""600"" fill=""#ffffff"" text-anchor=""middle"">$(Esc $Badge)</text>")
    }

    $lineRoom = $W - 46
    $ly = $Y + 62
    foreach ($line in $Lines) {
        if ([int]($line.Length * 6.3) -gt $lineRoom) {
            [void]$script:Overflow.Add(('line in a {0} px card (room {1} px): {2}' -f $W, $lineRoom, $line))
        }
        [void]$s.Add("  <text x=""$($X + 24)"" y=""$ly"" font-family=""$FONT"" font-size=""12.5"" fill=""$($C.muted)"">$(Esc $line)</text>")
        $ly += 19
    }
    return ($s -join "`n")
}

function New-Panel {
    param(
        [int]$X, [int]$Y, [int]$W, [int]$H, [string]$Label,
        [string]$Stroke, [string]$Fill, [string]$Ink = '#ffffff', [int]$Rx = 18
    )
    $lw = [int]($Label.Length * 7.6) + 28
    $s = New-Object System.Collections.ArrayList
    [void]$s.Add("  <rect x=""$X"" y=""$Y"" width=""$W"" height=""$H"" rx=""$Rx"" fill=""$Fill"" stroke=""$Stroke"" stroke-width=""1.6""/>")
    [void]$s.Add("  <rect x=""$($X + 22)"" y=""$($Y - 15)"" width=""$lw"" height=""28"" rx=""14"" fill=""$Stroke""/>")
    [void]$s.Add("  <text x=""$($X + 22 + [int]($lw / 2))"" y=""$($Y + 4)"" font-family=""$FONT"" font-size=""13"" font-weight=""700"" fill=""$Ink"" text-anchor=""middle"">$(Esc $Label)</text>")
    return ($s -join "`n")
}

function Get-ColorId {
    param([string]$Color)
    return ('c' + ($Color -replace '#', ''))
}

function Get-MarkerDefs {
    $colors = @($C.brand, $C.green, $C.orange, $C.muted, $C.faint, $C.dark, $C.red)
    $defs = New-Object System.Collections.ArrayList
    foreach ($c in $colors) {
        $id = Get-ColorId $c
        [void]$defs.Add("    <marker id=""ar-$id"" viewBox=""0 0 10 10"" refX=""9"" refY=""5"" markerWidth=""7"" markerHeight=""7"" orient=""auto-start-reverse""><path d=""M 0 0 L 10 5 L 0 10 z"" fill=""$c""/></marker>")
    }
    return ($defs -join "`n")
}

function New-Arrow {
    param(
        [int]$X1, [int]$Y1, [int]$X2, [int]$Y2, [string]$Color,
        [string]$Label = '', [switch]$Both, [switch]$Dashed,
        [int]$LabelDx = 0, [int]$LabelDy = -12
    )
    $id = Get-ColorId $Color
    $dash = ''
    if ($Dashed) { $dash = ' stroke-dasharray="7 5"' }
    $start = ''
    if ($Both) { $start = " marker-start=""url(#ar-$id)""" }

    $s = New-Object System.Collections.ArrayList
    [void]$s.Add("  <line x1=""$X1"" y1=""$Y1"" x2=""$X2"" y2=""$Y2"" stroke=""$Color"" stroke-width=""2.4""$dash marker-end=""url(#ar-$id)""$start/>")
    if ($Label) {
        $mx = [int](($X1 + $X2) / 2) + $LabelDx
        $my = [int](($Y1 + $Y2) / 2) + $LabelDy
        $lw = [int]($Label.Length * 6.2) + 18
        [void]$s.Add("  <rect x=""$($mx - [int]($lw / 2))"" y=""$($my - 14)"" width=""$lw"" height=""20"" rx=""6"" fill=""#ffffff"" stroke=""$($C.line)""/>")
        [void]$s.Add("  <text x=""$mx"" y=""$my"" font-family=""$MONO"" font-size=""11"" fill=""$($C.muted)"" text-anchor=""middle"">$(Esc $Label)</text>")
    }
    return ($s -join "`n")
}

# --------------------------------------------------------------- composition
# This file stays pure ASCII: PowerShell 5.1 reads a BOM-less UTF-8 script as
# ANSI, so the few typographic marks are built from code points at run time.
$DOT = [char]0x00B7
$MID = [char]0x2014

$body = New-Object System.Collections.ArrayList
function Add-Body { param([string]$Svg) [void]$body.Add($Svg) }

# ---- header ---------------------------------------------------------------
Add-Body "  <rect x=""0"" y=""0"" width=""$W"" height=""8"" fill=""$($C.brand)""/>"
Add-Body "  <text x=""60"" y=""82"" font-family=""$FONT"" font-size=""38"" font-weight=""800"" fill=""$($C.ink)"">Powerbind $MID System Design</text>"
Add-Body "  <text x=""60"" y=""114"" font-family=""$FONT"" font-size=""15.5"" fill=""$($C.muted)"">IoT smart-home energy management: ESP32 sensors and PZEM-004T meters over MQTT, a Spring Boot API, a Vue 3 SPA and a multimodal AI energy advisor.</text>"
Add-Body "  <text x=""1860"" y=""82"" font-family=""$MONO"" font-size=""13"" fill=""$($C.faint)"" text-anchor=""end"">Spring Boot 4.1.1 $DOT Java 17 $DOT Vue 3.5 $DOT Vite 8</text>"
Add-Body "  <line x1=""60"" y1=""142"" x2=""1860"" y2=""142"" stroke=""$($C.line)"" stroke-width=""2""/>"

# ---- devices (top left) ---------------------------------------------------
$dx = 60; $dw = 290
Add-Body (New-Panel -X $dx -Y 175 -W $dw -H 420 -Label "Devices & messaging" -Stroke $C.orange -Fill '#fff8f1')
Add-Body (New-Card -X ($dx + 22) -Y 212 -W ($dw - 44) -H 124 -Icon 'espressif' -Accent '#e7352c' -Title 'ESP32 sensors' -Lines @(
    'Occupancy, one per room',
    'Publishes to MQTT',
    'smart-home/presence/#'
))
Add-Body (New-Card -X ($dx + 22) -Y 350 -W ($dw - 44) -H 124 -Icon 'espressif' -Accent '#e7352c' -Title 'PZEM-004T meters' -Lines @(
    'Voltage, current, power, kWh',
    'ESP32 reads the meter over',
    'UART and publishes to power/#'
))
Add-Body (New-Card -X ($dx + 22) -Y 488 -W ($dw - 44) -H 88 -Icon 'eclipsemosquitto' -Accent $C.dark -Title 'Mosquitto' -Badge '1883' -Lines @(
    'Fan-out to the backend'
))

# ---- backend (top centre) -------------------------------------------------
$bx = 520; $bw = 900
Add-Body (New-Panel -X $bx -Y 175 -W $bw -H 420 -Label "Backend $MID Spring Boot API" -Stroke $C.brand -Fill '#f2f9fe')
$cardW = 274; $cardH = 172
$colX = @(($bx + 22), ($bx + 22 + $cardW + 20), ($bx + 22 + 2 * ($cardW + 20)))

Add-Body (New-Card -X $colX[0] -Y 212 -W $cardW -H $cardH -Icon 'springboot' -Accent '#6db33f' -Title 'REST & streaming' -Badge '8045' -Lines @(
    '/api/auth, /api/dashboard',
    '/api/rooms, /api/power',
    '/api/agent streams SSE answers',
    '/api/logs + /api/admin/** (ADMIN)',
    'springdoc-openapi: /swagger-ui'
))
Add-Body (New-Card -X $colX[1] -Y 212 -W $cardW -H $cardH -Icon 'jsonwebtokens' -Accent '#d63aff' -Title 'Security' -Lines @(
    'JWT access 1 h, refresh 7 days',
    'Role claim becomes ROLE_ADMIN',
    'Redis sliding limit 30 req / 60 s',
    'Lockout: 5 fails then 10 min'
))
Add-Body (New-Card -X $colX[2] -Y 212 -W $cardW -H $cardH -Icon 'eclipsemosquitto' -Accent $C.dark -Title 'IoT ingest' -Lines @(
    'Paho subscribes smart-home/#',
    'Presence and power W / V / A / kWh',
    'RoomTimeoutService marks a room',
    'offline after 30 s without data'
))

Add-Body (New-Card -X $colX[0] -Y 404 -W $cardW -H $cardH -Icon 'hibernate' -Accent '#59666c' -Title 'Persistence' -Lines @(
    'Spring Data JPA on PostgreSQL',
    'Flyway migrations V1 .. V8',
    'InfluxDB point writes and reads',
    'Redis counters for rate limiting'
))
Add-Body (New-Card -X $colX[1] -Y 404 -W $cardW -H $cardH -Mono 'G' -Accent $C.orange -Title 'AI energy advisor' -Lines @(
    'Groq: chat, vision, Whisper',
    'Per-user threads + long-term memory',
    'Document Q&A (PDF / DOCX / TXT)',
    'Memory extraction runs in background'
))
Add-Body (New-Card -X $colX[2] -Y 404 -W $cardW -H $cardH -Mono 'AD' -Accent $C.brand -Title 'Admin & telemetry API' -Lines @(
    '/api/admin/erd - live JPA schema',
    '/api/admin/logs - Loki proxy',
    '/api/admin/metrics - PromQL proxy',
    'Logback ships logs to Loki (loki4j)'
))

# ---- frontend (top right) -------------------------------------------------
$fx = 1560; $fw = 300
Add-Body (New-Panel -X $fx -Y 175 -W $fw -H 420 -Label 'Frontend - Vue 3 SPA' -Stroke '#3f9c6d' -Fill '#f2fbf6')
Add-Body (New-Card -X ($fx + 22) -Y 212 -W ($fw - 44) -H 124 -Icon 'vuedotjs' -Accent '#42b883' -Title 'Vue 3 SPA' -Badge '5173' -Lines @(
    'Vite 8 dev server',
    'Vue Router 5 + Pinia stores',
    '5 routes: login, dashboard,',
    'agent, ERD, logs'
))
Add-Body (New-Card -X ($fx + 22) -Y 348 -W ($fw - 44) -H 124 -Mono 'RT' -Accent $C.green -Title 'Live interaction' -Lines @(
    'axios + JWT interceptor',
    'SSE for AI chat streaming',
    'STOMP/SockJS for live power',
    'marked + Mermaid + DOMPurify'
))

# Icon strip: the client-side stack, drawn by hand because it is icons only.
$stripX = $fx + 22; $stripY = 484; $stripW = $fw - 44; $stripH = 96
Add-Body "  <rect x=""$stripX"" y=""$stripY"" width=""$stripW"" height=""$stripH"" rx=""12"" fill=""$($C.card)"" stroke=""$($C.line)""/>"
Add-Body "  <text x=""$($stripX + 18)"" y=""$($stripY + 30)"" font-family=""$FONT"" font-size=""14"" font-weight=""700"" fill=""$($C.ink)"">Client stack</text>"
$stripIcons = @(
    @{ s = 'vuedotjs';    c = '#42b883' },
    @{ s = 'vite';        c = '#646cff' },
    @{ s = 'tailwindcss'; c = '#06b6d4' },
    @{ s = 'pinia';       c = '#ffd859' },
    @{ s = 'axios';       c = '#5a29e4' }
)
$ix = $stripX + 18
foreach ($entry in $stripIcons) {
    Add-Body ('  ' + (New-Icon $entry.s $ix ($stripY + 46) 30 $entry.c))
    $ix += 44
}

# ---- observability (bottom left) ------------------------------------------
$ox = 60; $ow = 290
Add-Body (New-Panel -X $ox -Y 655 -W $ow -H 270 -Label 'Observability' -Stroke $C.dark -Fill '#f6f8f9')
Add-Body (New-Card -X ($ox + 22) -Y 692 -W ($ow - 44) -H 104 -Mono 'L' -Accent $C.dark -Title 'Loki' -Badge '3100' -Lines @(
    'Backend, frontend and IoT logs',
    'Queried by /api/admin/logs'
))
Add-Body (New-Card -X ($ox + 22) -Y 812 -W ($ow - 44) -H 104 -Icon 'grafana' -Accent $C.orange -Title 'Grafana' -Badge '3000' -Lines @(
    'Dashboards over Loki and',
    'Prometheus data sources'
))

# ---- data & AI (bottom centre) --------------------------------------------
$px = 520; $pw = 900
Add-Body (New-Panel -X $px -Y 655 -W $pw -H 270 -Label 'Data stores & AI provider' -Stroke '#7a5cf0' -Fill '#f7f5fe')
$dW = 200; $dGap = 22
$dX = @(($px + 22), ($px + 22 + $dW + $dGap), ($px + 22 + 2 * ($dW + $dGap)), ($px + 22 + 3 * ($dW + $dGap)))
Add-Body (New-Card -X $dX[0] -Y 692 -W $dW -H 190 -Icon 'postgresql' -Accent '#4169E1' -Title 'PostgreSQL 16' -Lines @(
    'Rooms, users, chats,',
    'tokens and memories',
    'Flyway V1..V8 migrations',
    'JPA via Hibernate'
))
Add-Body (New-Card -X $dX[1] -Y 692 -W $dW -H 190 -Icon 'influxdb' -Accent '#22ADF6' -Title 'InfluxDB 2.7' -Lines @(
    'Power and energy series',
    'One point per reading',
    '(W, V, A, kWh)',
    'Read for the charts'
))
Add-Body (New-Card -X $dX[2] -Y 692 -W $dW -H 190 -Icon 'redis' -Accent '#FF4438' -Title 'Redis 7' -Lines @(
    'Sliding-window limit',
    '30 requests / 60 s',
    'Login-attempt counters',
    'Shared across instances'
))
Add-Body (New-Card -X $dX[3] -Y 692 -W $dW -H 190 -Mono 'G' -Accent $C.orange -Title 'Groq API' -Lines @(
    'LLaMA chat + vision',
    'Whisper transcription',
    'PDF / DOCX / TXT parsing',
    'OpenAI-compatible HTTPS'
))

# ---- metrics & quality (bottom right) -------------------------------------
$qx = 1560; $qw = 300
Add-Body (New-Panel -X $qx -Y 655 -W $qw -H 270 -Label 'Metrics & quality gates' -Stroke '#0f8cd5' -Fill '#f2f9fe')
Add-Body (New-Card -X ($qx + 22) -Y 692 -W ($qw - 44) -H 104 -Icon 'prometheus' -Accent '#E6522C' -Title 'Prometheus' -Badge '9090' -Lines @(
    'Scrapes the backend actuator',
    'Feeds /api/admin/metrics'
))
Add-Body (New-Card -X ($qx + 22) -Y 812 -W ($qw - 44) -H 104 -Icon 'openjdk' -Accent '#f89820' -Title 'Quality gates' -Lines @(
    'JUnit, Mockito, RestAssured,',
    'Cucumber, Selenium, Allure'
))

# ---- flow arrows ----------------------------------------------------------
Add-Body (New-Arrow -X1 350 -Y1 330 -X2 520 -Y2 330 -Color $C.orange -Label 'MQTT smart-home/#')
Add-Body (New-Arrow -X1 1420 -Y1 280 -X2 1560 -Y2 280 -Color $C.brand -Label 'REST + SSE' -Both)
Add-Body (New-Arrow -X1 1420 -Y1 360 -X2 1560 -Y2 360 -Color $C.green -Label 'STOMP /ws' -Both)
Add-Body (New-Arrow -X1 642 -Y1 595 -X2 642 -Y2 655 -Color $C.brand -Label 'JPA' -Both -LabelDy 0)
Add-Body (New-Arrow -X1 864 -Y1 595 -X2 864 -Y2 655 -Color $C.green -Label 'points' -Both -LabelDy 0)
Add-Body (New-Arrow -X1 1308 -Y1 595 -X2 1308 -Y2 655 -Color $C.orange -Label 'HTTPS' -LabelDy 0)
Add-Body (New-Arrow -X1 560 -Y1 595 -X2 300 -Y2 655 -Color $C.dark -Label 'logs to Loki')
Add-Body (New-Arrow -X1 1620 -Y1 655 -X2 1380 -Y2 595 -Color $C.faint -Label 'scrape + PromQL' -Dashed)

# ---- legend ---------------------------------------------------------------
$lx = 60; $ly = 950; $lw = 1800; $lh = 150
Add-Body "  <rect x=""$lx"" y=""$ly"" width=""$lw"" height=""$lh"" rx=""18"" fill=""#ffffff"" stroke=""$($C.line)""/>"
Add-Body "  <text x=""$($lx + 30)"" y=""$($ly + 36)"" font-family=""$FONT"" font-size=""15"" font-weight=""700"" fill=""$($C.ink)"">Legend</text>"
$samples = @(
    @{ c = $C.brand;  d = $false; t = 'request / response: REST, JPA, MQTT' },
    @{ c = $C.green;  d = $false; t = 'live push: SSE tokens, STOMP topics' },
    @{ c = $C.orange; d = $false; t = 'device telemetry and Groq' },
    @{ c = $C.faint;  d = $true;  t = 'out-of-band: scraping, tooling' }
)
$sy = $ly + 64
foreach ($sample in $samples) {
    $dash = ''
    if ($sample.d) { $dash = ' stroke-dasharray="7 5"' }
    Add-Body "  <line x1=""$($lx + 30)"" y1=""$sy"" x2=""$($lx + 112)"" y2=""$sy"" stroke=""$($sample.c)"" stroke-width=""2.6""$dash marker-end=""url(#ar-$(Get-ColorId $sample.c))""/>"
    Add-Body "  <text x=""$($lx + 126)"" y=""$($sy + 5)"" font-family=""$FONT"" font-size=""13"" fill=""$($C.muted)"">$(Esc $sample.t)</text>"
    $sy += 24
}
$ny = $ly + 64
$notes = @(
    'The browser never talks to Loki, Prometheus, PostgreSQL, InfluxDB or Groq directly - every path goes through the backend.',
    'Admin endpoints (/api/admin/**) need the ADMIN role; the log and metrics pages proxy Loki and Prometheus so those URLs stay private.',
    'Generated by docs/diagrams/build.ps1 - brand icons from Simple Icons, palette taken from the frontend source.'
)
foreach ($note in $notes) {
    Add-Body "  <text x=""$($lx + 720)"" y=""$ny"" font-family=""$FONT"" font-size=""13"" fill=""$($C.muted)"">$(Esc $note)</text>"
    $ny += 24
}

# ------------------------------------------------------------------ assemble
$svgParts = New-Object System.Collections.ArrayList
[void]$svgParts.Add('<?xml version="1.0" encoding="UTF-8"?>')
[void]$svgParts.Add('<!-- Powerbind system design. Generated by build.ps1 - do not edit by hand. -->')
[void]$svgParts.Add("<svg xmlns=""http://www.w3.org/2000/svg"" width=""$W"" height=""$H"" viewBox=""0 0 $W $H"" font-family=""$FONT"">")
[void]$svgParts.Add('  <defs>')
[void]$svgParts.Add((Get-IconDefs))
[void]$svgParts.Add('')
[void]$svgParts.Add((Get-MarkerDefs))
[void]$svgParts.Add('    <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">')
[void]$svgParts.Add('      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.10"/>')
[void]$svgParts.Add('    </filter>')
[void]$svgParts.Add('  </defs>')
[void]$svgParts.Add("  <rect width=""$W"" height=""$H"" fill=""$($C.bg)""/>")
[void]$svgParts.Add(($body -join "`n"))
[void]$svgParts.Add('</svg>')

$svg = $svgParts -join "`n"
[System.IO.File]::WriteAllText($svgPath, $svg, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("svg  : {0} ({1:N0} KB)" -f (Split-Path $svgPath -Leaf), ((Get-Item $svgPath).Length / 1KB))

# ------------------------------------------------- validation before render
# Three cheap checks that would otherwise only show up in the picture: the file
# must be well-formed XML, every <use> must resolve to a symbol, and no text run
# may be wider than the card it sits in.
$doc = New-Object System.Xml.XmlDocument
$doc.Load($svgPath)

$ids = @{}
foreach ($node in $doc.SelectNodes('//*[@id]')) { $ids[$node.GetAttribute('id')] = $true }
$uses = $doc.SelectNodes('//*[local-name()="use"]')
$unresolved = New-Object System.Collections.ArrayList
foreach ($use in $uses) {
    $reference = $use.GetAttribute('href').TrimStart('#')
    if (-not $ids.ContainsKey($reference)) { [void]$unresolved.Add($reference) }
}
if ($unresolved.Count -gt 0) {
    throw ('unresolved icon references: ' + (($unresolved | Sort-Object -Unique) -join ', '))
}
Write-Host ("xml  : ok - {0} symbols, {1} icon uses" -f $ICONS.Count, $uses.Count)
if ($script:Overflow.Count -gt 0) {
    Write-Warning ("{0} text run(s) may overflow their card:" -f $script:Overflow.Count)
    foreach ($row in $script:Overflow) { Write-Warning ("  $row") }
}

# ------------------------------------------------------------------- render
# Chrome/Edge renders the SVG at 2x and System.Drawing turns the PNG into a
# JPEG. Neither step needs a third-party tool to be installed.
$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge is needed to rasterise the SVG' }

Remove-Item -LiteralPath $pngPath -Force -ErrorAction SilentlyContinue
$uri = 'file:///' + ($svgPath -replace '\\', '/')

# Chrome writes its progress to stderr, and with ErrorActionPreference set to
# Stop a native command that touches stderr aborts the script. Merge the stream
# and relax the preference around this one call.
$preference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & $browser '--headless=new' '--disable-gpu' '--hide-scrollbars' '--no-first-run' "--force-device-scale-factor=$SCALE" "--window-size=$W,$H" "--screenshot=$pngPath" $uri 2>&1 | Out-Null
} finally {
    $ErrorActionPreference = $preference
}
if (-not (Test-Path -LiteralPath $pngPath)) { Start-Sleep -Seconds 3 }
if (-not (Test-Path -LiteralPath $pngPath)) { throw 'the headless browser produced no screenshot' }

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($pngPath)
try {
    $bitmap = New-Object System.Drawing.Bitmap($image.Width, $image.Height)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
        } finally { $graphics.Dispose() }

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
        $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encoderParameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]92)
        $bitmap.Save($jpgPath, $codec, $encoderParameters)
    } finally { $bitmap.Dispose() }
} finally { $image.Dispose() }

$jpgFile = Get-Item -LiteralPath $jpgPath
$raster = [System.Drawing.Image]::FromFile($jpgPath)
try {
    Write-Host ("png  : {0} x {1} px (render scale {2}x)" -f ($W * $SCALE), ($H * $SCALE), $SCALE)
    Write-Host ("jpg  : {0} x {1} px, {2:N0} KB" -f $raster.Width, $raster.Height, ($jpgFile.Length / 1KB))
} finally { $raster.Dispose() }

if (-not $KeepPng) { Remove-Item -LiteralPath $pngPath -Force -ErrorAction SilentlyContinue }
Write-Host 'done.'
