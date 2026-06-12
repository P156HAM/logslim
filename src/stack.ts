/**
 * Stack-trace compaction. The model needs the error message and the frames
 * in YOUR code — not 40 frames of node_modules/site-packages internals.
 *
 * Strategy: within a run of consecutive frames, keep app frames, collapse
 * runs of vendor/internal frames into one marker line. As a safety net,
 * very long frame runs are also capped (first frames + last frame).
 */

const NODE_FRAME_RE = /^\s+at\s/;
const PY_FRAME_RE = /^\s+File\s+"/;

function isFrame(line: string): boolean {
  return NODE_FRAME_RE.test(line) || PY_FRAME_RE.test(line);
}

const VENDOR_RE =
  /node_modules|node:internal|\(internal\/|site-packages|dist-packages|\/usr\/lib\/python|<frozen /;

function isVendorFrame(line: string): boolean {
  return VENDOR_RE.test(line);
}

const MAX_APP_FRAMES_PER_RUN = 12;

export function collapseStackFrames(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (!isFrame(lines[i])) {
      out.push(lines[i]);
      i++;
      continue;
    }

    // Collect the whole consecutive frame run. Python frames are followed by
    // a source line; treat those as part of the run.
    const run: string[] = [];
    while (i < lines.length && (isFrame(lines[i]) || (run.length > 0 && PY_FRAME_RE.test(run[run.length - 1])))) {
      run.push(lines[i]);
      i++;
    }

    out.push(...compactFrameRun(run));
  }

  return out;
}

function compactFrameRun(run: string[]): string[] {
  const out: string[] = [];
  let vendorBuffer: string[] = [];
  let appFrames = 0;

  const flushVendors = () => {
    if (vendorBuffer.length === 0) return;
    if (vendorBuffer.length <= 2) {
      out.push(...vendorBuffer);
    } else {
      out.push(vendorBuffer[0]);
      out.push(`    … ${vendorBuffer.length - 1} vendor/internal frames collapsed by logslim`);
    }
    vendorBuffer = [];
  };

  for (const line of run) {
    if (isFrame(line) && isVendorFrame(line)) {
      vendorBuffer.push(line);
      continue;
    }
    flushVendors();
    if (isFrame(line)) {
      appFrames++;
      if (appFrames === MAX_APP_FRAMES_PER_RUN + 1) {
        out.push(`    … deeper frames collapsed by logslim`);
      }
      if (appFrames > MAX_APP_FRAMES_PER_RUN) continue;
    }
    out.push(line);
  }
  flushVendors();
  return out;
}
