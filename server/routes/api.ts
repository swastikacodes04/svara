import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { AudioValidationError } from '../audio/decoder.ts';
import { sanitizeFileName } from '../audio/musicTheory.ts';
import { runFullAudioAnalysis } from '../services/analysisPipeline.ts';
import { loadPakadReferences, loadRagas } from '../services/dataLoader.ts';
import { isGeminiConfigured } from '../services/explainabilityService.ts';

export function createApiRouter(): express.Router {
  const router = express.Router();

  const maxUploadMb = Math.max(
    1,
    Math.min(100, Number(process.env.MAX_UPLOAD_MB || '25') || 25),
  );
  const maxUploadBytes = maxUploadMb * 1024 * 1024;
  const uploadTempDir = path.join(os.tmpdir(), 'svara-uploads');

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(uploadTempDir, { recursive: true })
        .then(() => cb(null, uploadTempDir))
        .catch((err) => cb(err as Error, uploadTempDir));
    },
    filename: (_req, file, cb) => {
      const safeOriginal = sanitizeFileName(file.originalname || 'recording.wav');
      const ext = path.extname(safeOriginal).toLowerCase();
      const randomPrefix = crypto.randomBytes(12).toString('hex');
      cb(null, `${randomPrefix}${ext === '.mp3' ? '.mp3' : '.wav'}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: maxUploadBytes,
      files: 1,
    },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (ext !== '.wav' && ext !== '.mp3') {
        cb(
          new AudioValidationError(
            'Unsupported audio format. Only .wav and .mp3 files are accepted.',
            400,
          ),
        );
        return;
      }
      cb(null, true);
    },
  });

  // GET /api/health
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      const [ragas, pakads] = await Promise.all([
        loadRagas(),
        loadPakadReferences(),
      ]);
      res.json({
        status: 'ok',
        service: 'SVARA Audio Intelligence API',
        audioEngineReady: true,
        classifierConfigured: Boolean(process.env.RAGA_MODEL_API_URL?.trim()),
        geminiExplainabilityConfigured: isGeminiConfigured(),
        supportedClassifierTradition: 'Hindustani',
        ragaLibraryCount: ragas.length,
        pakadReferenceCount: pakads.length,
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: err instanceof Error ? err.message : 'Health check failed',
      });
    }
  });

  // GET /api/ragas
  router.get('/ragas', async (req: Request, res: Response) => {
    try {
      const ragas = await loadRagas();
      const traditionParam =
        typeof req.query.tradition === 'string' ? req.query.tradition.trim() : '';
      const searchParam =
        typeof req.query.search === 'string'
          ? req.query.search.trim().toLowerCase()
          : '';

      const filtered = ragas.filter((r) => {
        if (
          traditionParam &&
          traditionParam !== 'All' &&
          r.tradition.toLowerCase() !== traditionParam.toLowerCase()
        ) {
          return false;
        }
        if (searchParam) {
          const haystack = [
            r.name,
            r.thaat,
            r.pakad,
            r.aarohana,
            r.avarohana,
            r.vadi,
            r.samvadi,
            ...r.importantSvaras,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(searchParam);
        }
        return true;
      });

      res.json({
        traditionScopeNote:
          'Initial ML classifier scope is restricted to Hindustani Classical Ragas. Carnatic Ragas are catalogued separately and never mixed into a single uncalibrated classifier.',
        count: filtered.length,
        ragas: filtered,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to load Raga library',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // GET /api/ragas/:id
  router.get('/ragas/:id', async (req: Request, res: Response) => {
    try {
      const rawId = String(req.params.id || '');
      if (!/^[a-z0-9_-]{1,64}$/i.test(rawId)) {
        res.status(400).json({ error: 'Invalid Raga identifier format.' });
        return;
      }

      const [ragas, pakads] = await Promise.all([
        loadRagas(),
        loadPakadReferences(),
      ]);
      const raga = ragas.find((r) => r.id.toLowerCase() === rawId.toLowerCase());
      if (!raga) {
        res.status(404).json({ error: `Raga "${rawId}" was not found.` });
        return;
      }

      const relatedPakads = pakads.filter((p) => p.ragaId === raga.id);
      res.json({
        raga,
        curatedPakadReferences: relatedPakads,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Failed to fetch Raga details',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // POST /api/analyze
  router.post(
    '/analyze',
    (req: Request, res: Response, next: NextFunction) => {
      upload.single('audio')(req, res, (err: unknown) => {
        if (!err) {
          next();
          return;
        }
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({
              error: `Uploaded file exceeds maximum allowed size of ${maxUploadMb} MB.`,
            });
            return;
          }
          res.status(400).json({ error: `Upload error: ${err.message}` });
          return;
        }
        if (err instanceof AudioValidationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Invalid audio upload.',
        });
      });
    },
    async (req: Request, res: Response) => {
      const uploadedFile = req.file;
      if (!uploadedFile) {
        res.status(400).json({
          error: 'No audio file received. Please attach a .wav or .mp3 file under field "audio".',
        });
        return;
      }

      // Path traversal safety check: ensure temp file stays strictly inside uploadTempDir
      const resolvedTemp = path.resolve(uploadedFile.path);
      const resolvedDir = path.resolve(uploadTempDir);
      if (!resolvedTemp.startsWith(resolvedDir + path.sep)) {
        res.status(400).json({ error: 'Unsafe upload path rejected.' });
        return;
      }

      const safeName = sanitizeFileName(uploadedFile.originalname || 'recording.wav');
      console.info(
        `[SVARA] /api/analyze start file=${safeName} size=${uploadedFile.size}B`,
      );

      try {
        const result = await runFullAudioAnalysis({
          filePath: resolvedTemp,
          originalFileName: safeName,
          fileSizeBytes: uploadedFile.size,
          maxUploadBytes,
        });
        console.info(
          `[SVARA] /api/analyze complete id=${result.analysisId} tonic=${result.tonic.estimatedFrequencyHz ?? 'none'}Hz voiced=${result.pitch.voicedFrames}/${result.pitch.totalFrames} classifier=${result.classification.status}`,
        );
        res.json(result);
      } catch (err) {
        const statusCode =
          err instanceof AudioValidationError ? err.statusCode : 422;
        const message =
          err instanceof Error ? err.message : 'Audio analysis failed.';
        console.warn(`[SVARA] /api/analyze rejected (${statusCode}): ${message}`);
        res.status(statusCode).json({ error: message });
      } finally {
        // Privacy-conscious cleanup: delete temp audio file immediately after processing
        await fs.unlink(resolvedTemp).catch(() => undefined);
      }
    },
  );

  return router;
}
