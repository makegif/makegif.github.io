import { useState, useRef, useId } from 'react';
import { defaultLang, ui, type SupportedLanguage } from '../i18n/ui';
import {
  Upload,
  Film,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface GifWorkspaceProps {
  lang?: SupportedLanguage;
}

type ProcessingStage =
  | 'idle'
  | 'loading-core'
  | 'ready'
  | 'preparing'
  | 'generating-palette'
  | 'encoding'
  | 'finalizing'
  | 'done'
  | 'error';

export default function GifWorkspace({ lang = defaultLang }: GifWorkspaceProps) {
  const t = (key: keyof typeof ui[typeof defaultLang]): string => {
    const dict = ui[lang] || ui[defaultLang];
    return (dict as Record<string, string>)[key] || (ui[defaultLang] as Record<string, string>)[key] || key;
  };

  // State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoNaturalWidth, setVideoNaturalWidth] = useState<number>(0);

  // Video playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Trimming parameters
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(5);

  // Settings
  const [fps, setFps] = useState<number>(15);
  const [resolution, setResolution] = useState<string>('640');
  const [speed, setSpeed] = useState<number>(1.0);

  // Processing & Engine
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifSize, setGifSize] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Drag over state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ffmpegRef = useRef<any>(null);
  const ffmpegLoadedRef = useRef<boolean>(false);

  // Unique IDs for accessible form controls
  const startTimeId = useId();
  const endTimeId = useId();
  const resolutionId = useId();

  // Helper: format seconds to mm:ss.s
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Helper: format bytes to KB/MB
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Load FFmpeg instance with multi-source fallback
  const initFFmpeg = async () => {
    if (ffmpegRef.current && ffmpegLoadedRef.current) {
      return ffmpegRef.current;
    }

    setStage('loading-core');
    setProgress(10);

    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('log', ({ message }: { message: string }) => {
      console.log('[FFmpeg]', message);
      if (message.includes('palettegen')) {
        setStage('generating-palette');
      } else if (message.includes('paletteuse') || message.includes('frame=')) {
        setStage('encoding');
      }
    });

    ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
      const pct = Math.min(Math.round(p * 100), 98);
      setProgress(pct);
    });

    // Multi-tier core sources:
    // 1. Local same-origin static files (/ffmpeg/ffmpeg-core.js)
    // 2. unpkg.com CDN
    // 3. cdn.jsdelivr.net CDN
    const coreSources = [
      {
        core: '/ffmpeg/ffmpeg-core.js',
        wasm: '/ffmpeg/ffmpeg-core.wasm',
      },
      {
        core: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
        wasm: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
      },
      {
        core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js',
        wasm: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm',
      },
    ];

    let lastError: any = null;
    for (const src of coreSources) {
      try {
        console.log('[FFmpeg] Trying to load core from:', src.core);
        await ffmpeg.load({
          coreURL: await toBlobURL(src.core, 'text/javascript'),
          wasmURL: await toBlobURL(src.wasm, 'application/wasm'),
        });
        ffmpegLoadedRef.current = true;
        setStage('ready');
        return ffmpeg;
      } catch (err: any) {
        console.warn(`[FFmpeg] Loading from ${src.core} failed:`, err);
        lastError = err;
      }
    }

    const msg = lastError?.message || 'Failed to load FFmpeg WASM core from all sources.';
    setErrorMessage(`${t('workspace.statusError')} (${msg})`);
    setStage('error');
    throw lastError || new Error(msg);
  };

  // Handle incoming file
  const handleFileSelect = (file: File) => {
    const validExtensions = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
    const isNamedValid = /\.(mp4|webm|mov|m4v)$/i.test(file.name);

    if (!validExtensions.includes(file.type) && !isNamedValid) {
      setErrorMessage(t('workspace.errInvalidFile'));
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setErrorMessage(t('workspace.errSize'));
      return;
    }

    setErrorMessage(null);
    setGifUrl(null);
    setGifBlob(null);

    // Revoke previous object URL if any
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(objectUrl);
    setStage('idle');
  };

  // Video loaded metadata
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      const width = videoRef.current.videoWidth;

      setVideoDuration(duration);
      setVideoNaturalWidth(width);
      setStartTime(0);
      setEndTime(Math.min(5, Math.max(1, duration)));
    }
  };

  // Play/Pause toggle
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        if (videoRef.current.currentTime >= endTime) {
          videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Track playback time and loop within trim range
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      if (cur >= endTime && isPlaying) {
        videoRef.current.currentTime = startTime;
      }
    }
  };

  // Scrub video on slider change
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Trigger conversion
  const handleGenerateGif = async () => {
    if (!videoFile) return;

    try {
      setErrorMessage(null);
      setProgress(5);
      setStage('preparing');

      const ffmpeg = await initFFmpeg();
      const { fetchFile } = await import('@ffmpeg/util');

      const clipDuration = Math.max(0.1, endTime - startTime);
      const ext = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const inputFileName = `input.${ext}`;
      const outputFileName = 'output.gif';

      // Write video to virtual filesystem
      setProgress(15);
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

      // Build video filter chain:
      // scale=width:-2 ensures height is always an even number, preventing encoder errors
      let scaleFilter = '';
      if (resolution === 'original') {
        scaleFilter = 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos';
      } else {
        scaleFilter = `scale=${resolution}:-2:flags=lanczos`;
      }

      // Speed adjustment filter if different from 1.0
      const speedFilter = speed !== 1.0 ? `,setpts=PTS/${speed}` : '';

      // Clean two-pass adaptive palette command
      const vf = `fps=${fps}${speedFilter},${scaleFilter},split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer`;

      setStage('generating-palette');
      setProgress(25);

      const args = [
        '-i',
        inputFileName,
        '-ss',
        startTime.toFixed(3),
        '-t',
        clipDuration.toFixed(3),
        '-vf',
        vf,
        '-f',
        'gif',
        outputFileName,
      ];

      console.log('[FFmpeg] Executing command:', args);
      const ret = await ffmpeg.exec(args);
      console.log('[FFmpeg] Return code:', ret);

      // If two-pass palettegen fails (e.g. out of memory on large videos), fallback to standard palette encoding
      if (ret !== 0) {
        console.warn('[FFmpeg] Two-pass filter exited with code', ret, '- attempting standard encoding fallback...');
        const simpleVf = `fps=${fps}${speedFilter},${scaleFilter}`;
        const fallbackArgs = [
          '-i',
          inputFileName,
          '-ss',
          startTime.toFixed(3),
          '-t',
          clipDuration.toFixed(3),
          '-vf',
          simpleVf,
          '-f',
          'gif',
          outputFileName,
        ];
        const retFallback = await ffmpeg.exec(fallbackArgs);
        if (retFallback !== 0) {
          throw new Error(`FFmpeg processing failed (exit code ${retFallback})`);
        }
      }

      setStage('finalizing');
      setProgress(95);

      // Read output
      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([data], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);

      setGifBlob(blob);
      setGifUrl(url);
      setGifSize(blob.size);
      setStage('done');
      setProgress(100);

      // Clean up virtual files
      await ffmpeg.deleteFile(inputFileName).catch(() => {});
      await ffmpeg.deleteFile(outputFileName).catch(() => {});
    } catch (err: any) {
      console.error('GIF generation error:', err);
      const details = err?.message ? `: ${err.message}` : '';
      setErrorMessage(`${t('workspace.statusError')}${details}`);
      setStage('error');
    }
  };

  // Copy GIF to Clipboard
  const handleCopyClipboard = async () => {
    if (!gifBlob) return;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/gif': gifBlob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        // Fallback for browsers that don't support image/gif clipboard
        const url = URL.createObjectURL(gifBlob);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  // Reset workspace
  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setGifUrl(null);
    setGifBlob(null);
    setStage('idle');
    setProgress(0);
    setErrorMessage(null);
  };

  const selectedDuration = Math.max(0, endTime - startTime);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Privacy Guarantee Header Badge */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sage/10 dark:bg-sage/20 border border-sage/20 text-sage-800 dark:text-sage-300 text-xs sm:text-sm font-medium shadow-sm">
          <ShieldCheck className="w-4 h-4 text-sage shrink-0" />
          <span>{t('workspace.privacyNotice')}</span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* DROPZONE: When no video is uploaded */}
      {!videoUrl ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-3xl border-2 border-dashed transition-all duration-200 p-8 sm:p-16 text-center cursor-pointer ${
            isDragOver
              ? 'border-sage bg-sage/15 scale-[1.01]'
              : 'border-sage/40 hover:border-sage bg-white dark:bg-slate-900/60 hover:bg-sage/5'
          } shadow-sm`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-sage/15 dark:bg-sage/20 text-sage flex items-center justify-center mx-auto mb-6">
            <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t('workspace.dropzoneTitle')}{' '}
            <span className="text-sage underline decoration-sage/50 underline-offset-4">
              {t('workspace.dropzoneBrowse')}
            </span>
          </h3>

          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {t('workspace.dropzoneFormats')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {['MP4', 'WebM', 'MOV', 'M4V'].map((ext) => (
              <span
                key={ext}
                className="px-2.5 py-1 rounded-md bg-warmBorder/60 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300"
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* WORKSPACE: Video Preview + Controls (Two-Column on Desktop) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Video Preview & Scrubber (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-warmBorder dark:border-slate-800 p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-sage" />
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {t('workspace.previewTitle')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('workspace.btnConvertAnother')}</span>
                </button>
              </div>

              {/* HTML5 Video Element */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center shadow-inner group">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  playsInline
                />

                {/* Big Center Play/Pause button on hover */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
                  aria-label="Toggle playback"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                {/* Bottom playback indicator */}
                <div className="absolute bottom-2 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-mono">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </div>
              </div>

              {/* Trimming Range Controls */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-sage" />
                    <span>{t('workspace.trimRange')}</span>
                  </span>
                  <span className="text-sage font-bold">
                    {t('workspace.selectedLength')}: {selectedDuration.toFixed(1)}
                    {t('workspace.seconds')}
                  </span>
                </div>

                {/* Start Time Slider & Controls */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <label htmlFor={startTimeId}>{t('workspace.startTime')}</label>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatTime(startTime)}
                    </span>
                  </div>
                  <input
                    id={startTimeId}
                    type="range"
                    min="0"
                    max={Math.max(0.1, videoDuration)}
                    step="0.1"
                    value={startTime}
                    onChange={(e) => {
                      const val = Math.min(parseFloat(e.target.value), endTime - 0.1);
                      setStartTime(Math.max(0, val));
                      handleSeek(val);
                    }}
                    className="w-full accent-sage h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.min(currentTime, endTime - 0.1);
                      setStartTime(Math.max(0, val));
                    }}
                    className="text-[11px] text-sage hover:underline"
                  >
                    ↳ {t('workspace.setStartCurrent')}
                  </button>
                </div>

                {/* End Time Slider & Controls */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <label htmlFor={endTimeId}>{t('workspace.endTime')}</label>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatTime(endTime)}
                    </span>
                  </div>
                  <input
                    id={endTimeId}
                    type="range"
                    min="0.1"
                    max={Math.max(0.1, videoDuration)}
                    step="0.1"
                    value={endTime}
                    onChange={(e) => {
                      const val = Math.max(parseFloat(e.target.value), startTime + 0.1);
                      setEndTime(Math.min(videoDuration, val));
                      handleSeek(val);
                    }}
                    className="w-full accent-sage h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.max(currentTime, startTime + 0.1);
                      setEndTime(Math.min(videoDuration, val));
                    }}
                    className="text-[11px] text-sage hover:underline"
                  >
                    ↳ {t('workspace.setEndCurrent')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: GIF Settings & Action (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-warmBorder dark:border-slate-800 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 pb-4 border-b border-warmBorder dark:border-slate-800">
                <Sparkles className="w-5 h-5 text-sage" />
                <h4 className="font-bold text-slate-900 dark:text-white text-base">
                  {t('workspace.settingsTitle')}
                </h4>
              </div>

              {/* Framerate (FPS) Presets */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('workspace.fpsLabel')}
                  </label>
                  <span className="text-xs text-sage font-bold">{fps} FPS</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[10, 15, 20, 24, 30].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFps(f)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        fps === f
                          ? 'bg-sage text-white border-sage shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-warmBorder dark:border-slate-700 hover:border-sage'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('workspace.fpsTip')}
                </p>
              </div>

              {/* Resolution Dropdown */}
              <div>
                <label
                  htmlFor={resolutionId}
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >
                  {t('workspace.resolutionLabel')}
                </label>
                <select
                  id={resolutionId}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-warmBorder dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sage"
                >
                  <option value="320">{t('workspace.res320')}</option>
                  <option value="480">{t('workspace.res480')}</option>
                  <option value="640">{t('workspace.res640')}</option>
                  <option value="800">{t('workspace.res800')}</option>
                  <option value="original">
                    {t('workspace.resOriginal')} ({videoNaturalWidth}px)
                  </option>
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('workspace.resolutionTip')}
                </p>
              </div>

              {/* Speed Buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {t('workspace.speedLabel')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1.0, label: t('workspace.speed1x') },
                    { val: 1.5, label: t('workspace.speed15x') },
                    { val: 2.0, label: t('workspace.speed2x') },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setSpeed(s.val)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                        speed === s.val
                          ? 'bg-sage text-white border-sage'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-warmBorder dark:border-slate-700 hover:border-sage'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Convert Action Button / Progress */}
              <div className="pt-4 border-t border-warmBorder dark:border-slate-800">
                {stage !== 'idle' && stage !== 'done' && stage !== 'error' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-sage animate-pulse" />
                        {stage === 'loading-core' && t('workspace.loadingCore')}
                        {stage === 'preparing' && t('workspace.statusPreparing')}
                        {stage === 'generating-palette' && t('workspace.statusPalette')}
                        {stage === 'encoding' && t('workspace.statusEncoding')}
                        {stage === 'finalizing' && t('workspace.statusFinalizing')}
                      </span>
                      <span className="font-mono text-sage">{progress}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-warmBorder dark:border-slate-700">
                      <div
                        className="h-full bg-sage transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateGif}
                    className="w-full py-3.5 px-6 rounded-xl bg-sage hover:bg-sage-600 active:scale-[0.99] text-white font-bold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-sage/30"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>{t('workspace.btnGenerate')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATED GIF RESULT PANEL */}
      {gifUrl && (
        <div className="mt-12 rounded-3xl bg-white dark:bg-slate-900 border border-warmBorder dark:border-slate-800 p-6 sm:p-10 shadow-lg animate-in fade-in zoom-in-95 duration-300">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <Check className="w-3.5 h-3.5" />
              <span>{t('workspace.statusComplete')}</span>
            </div>

            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t('workspace.resultTitle')}
            </h3>

            {/* Rendered GIF Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-warmBorder dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 shadow-inner inline-block max-w-full">
              <img
                src={gifUrl}
                alt="Generated GIF Preview"
                className="rounded-xl max-h-[420px] w-auto mx-auto object-contain"
              />
            </div>

            {/* GIF Metadata Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-warmBorder dark:border-slate-700">
                {t('workspace.metaSize')}: <strong className="text-slate-900 dark:text-white">{formatBytes(gifSize)}</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-warmBorder dark:border-slate-700">
                {t('workspace.metaDuration')}: <strong className="text-slate-900 dark:text-white">{selectedDuration.toFixed(1)}s</strong>
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-warmBorder dark:border-slate-700">
                {t('workspace.metaFps')}: <strong className="text-slate-900 dark:text-white">{fps} FPS</strong>
              </span>
            </div>

            {/* Action Buttons: Download & Copy */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={gifUrl}
                download={videoFile ? `${videoFile.name.replace(/\.[^/.]+$/, '')}-makegif.gif` : 'makegif.gif'}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-sage hover:bg-sage-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{t('workspace.btnDownload')}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyClipboard}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-warmBorder dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {t('workspace.btnCopied')}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('workspace.btnCopy')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t('workspace.btnConvertAnother')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
