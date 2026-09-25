import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  IconButton,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChevronLeftRounded,
  ChevronRightRounded,
  FitScreenRounded,
  ZoomInRounded,
  ZoomOutRounded,
} from "@mui/icons-material";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { fetchApiFile } from "../api/client";

export type PdfEvidenceHighlight = {
  page: number;
  text: string;
  bbox: [number, number, number, number];
};

export function PdfDocumentViewer({
  sourcePath,
  originalName,
  highlight,
  minHeight = 500,
  maxHeight = 720,
}: {
  sourcePath: string;
  originalName: string;
  highlight?: PdfEvidenceHighlight | null;
  minHeight?: number;
  maxHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let loadedDocument: PDFDocumentProxy | null = null;
    setLoading(true);
    setError("");
    setDocument(null);
    setPageNumber(1);
    setZoom(1);

    void Promise.all([fetchApiFile(sourcePath), import("pdfjs-dist")])
      .then(async ([blob, pdfjs]) => {
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
        return pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise;
      })
      .then((pdf) => {
        loadedDocument = pdf;
        if (!active) {
          void pdf.destroy();
          return;
        }
        setDocument(pdf);
      })
      .catch(() => {
        if (active)
          setError("Le PDF ne peut pas être affiché dans Fiscora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (loadedDocument) void loadedDocument.destroy();
    };
  }, [sourcePath]);

  useEffect(() => {
    if (!document || !highlight) return;
    const targetPage = Math.min(
      document.numPages,
      Math.max(1, Math.trunc(highlight.page || 1)),
    );
    setPageNumber(targetPage);
  }, [document, highlight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!document || !canvas || containerWidth <= 0) return;
    let active = true;
    let renderTask: RenderTask | null = null;
    setRendering(true);
    setError("");

    void document
      .getPage(pageNumber)
      .then((page) => {
        if (!active) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, containerWidth - 40);
        const cssScale = (availableWidth / baseViewport.width) * zoom;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width / pixelRatio}px`;
        canvas.style.height = `${viewport.height / pixelRatio}px`;
        renderTask = page.render({ canvas, viewport });
        return renderTask.promise;
      })
      .catch((reason: unknown) => {
        if (
          active &&
          (!reason ||
            typeof reason !== "object" ||
            !("name" in reason) ||
            reason.name !== "RenderingCancelledException")
        )
          setError("Cette page du PDF ne peut pas être rendue.");
      })
      .finally(() => {
        if (active) setRendering(false);
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [containerWidth, document, loading, pageNumber, zoom]);

  const visibleHighlight =
    highlight && Math.trunc(highlight.page || 1) === pageNumber
      ? highlight
      : null;

  return (
    <Box
      ref={containerRef}
      aria-label={`Aperçu PDF de ${originalName}`}
      sx={{
        width: "100%",
        minWidth: 0,
        minHeight,
        maxHeight,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "grey.200",
      }}
    >
      <Box
        sx={{
          minHeight: 48,
          px: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          bgcolor: "common.white",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Tooltip title="Page précédente">
          <span>
            <IconButton
              size="small"
              disabled={!document || pageNumber <= 1}
              onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            >
              <ChevronLeftRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: 72, textAlign: "center" }}>
          {document ? `${pageNumber} / ${document.numPages}` : "— / —"}
        </Typography>
        <Tooltip title="Page suivante">
          <span>
            <IconButton
              size="small"
              disabled={!document || pageNumber >= document.numPages}
              onClick={() =>
                setPageNumber((value) =>
                  document ? Math.min(document.numPages, value + 1) : value,
                )
              }
            >
              <ChevronRightRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ width: 1, height: 24, bgcolor: "divider", mx: 0.5 }} />
        <Tooltip title="Réduire">
          <span>
            <IconButton
              size="small"
              disabled={!document || zoom <= 0.6}
              onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}
            >
              <ZoomOutRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 42, textAlign: "center" }}>
          {Math.round(zoom * 100)} %
        </Typography>
        <Tooltip title="Agrandir">
          <span>
            <IconButton
              size="small"
              disabled={!document || zoom >= 2}
              onClick={() => setZoom((value) => Math.min(2, value + 0.2))}
            >
              <ZoomInRounded />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Adapter à la largeur">
          <span>
            <IconButton
              size="small"
              disabled={!document || zoom === 1}
              onClick={() => setZoom(1)}
            >
              <FitScreenRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 2.5,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        {loading && <Skeleton variant="rounded" width="80%" height="90%" />}
        {error && (
          <Alert severity="error" sx={{ alignSelf: "flex-start" }}>
            {error}
          </Alert>
        )}
        {!loading && !error && (
          <Box
            sx={{
              position: "relative",
              lineHeight: 0,
              bgcolor: "common.white",
              boxShadow: 2,
            }}
          >
            <Box component="canvas" ref={canvasRef} sx={{ display: "block" }} />
            {visibleHighlight && (
              <>
                <Box
                  aria-label={`Zone extraite ${visibleHighlight.text}`}
                  sx={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: `${visibleHighlight.bbox[0] / 10}%`,
                    top: `${visibleHighlight.bbox[1] / 10}%`,
                    width: `${(visibleHighlight.bbox[2] - visibleHighlight.bbox[0]) / 10}%`,
                    height: `${(visibleHighlight.bbox[3] - visibleHighlight.bbox[1]) / 10}%`,
                    border: "3px solid",
                    borderColor: "warning.main",
                    bgcolor: "rgba(255, 193, 7, 0.2)",
                    boxShadow: "0 0 0 2px rgba(255,255,255,.9)",
                    zIndex: 2,
                  }}
                />
                {visibleHighlight.text && (
                  <Box
                    sx={{
                      position: "absolute",
                      pointerEvents: "none",
                      left: `${visibleHighlight.bbox[0] / 10}%`,
                      top: `${visibleHighlight.bbox[1] / 10}%`,
                      transform: "translateY(-100%)",
                      maxWidth: 260,
                      px: 1,
                      py: 0.5,
                      bgcolor: "warning.main",
                      color: "warning.contrastText",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      zIndex: 3,
                    }}
                  >
                    {visibleHighlight.text}
                  </Box>
                )}
              </>
            )}
            {rendering && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  bgcolor: "rgba(255,255,255,.48)",
                }}
              />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
