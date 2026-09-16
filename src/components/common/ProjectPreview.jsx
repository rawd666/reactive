import { useEffect } from "react";
import { Maximize2, X, ArrowUpRight } from "lucide-react";

function ProjectPreview({ project, expanded, onExpand, onClose }) {
  const visit = () => window.open(project.url, "_blank", "noopener,noreferrer");

  useEffect(() => {
    if (!expanded) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [expanded, onClose]);

  return (
    <>
      <div className="rx-preview-card">
        <div className="rx-preview-bar">
          <span className="rx-dot" style={{ background: "#ff1f7d" }}></span>
          <span className="rx-dot" style={{ background: "#febc2e" }}></span>
          <span className="rx-dot" style={{ background: "#28c840" }}></span>
          <span className="rx-preview-url rx-mono">{project.label}</span>
        </div>
        <div className="rx-preview-frame">
          <iframe src={project.url} title={project.name} tabIndex={-1} loading="lazy" />
          <button
            className="rx-preview-clickcatcher"
            onClick={visit}
            aria-label={`Visit ${project.name} in a new tab`}
          ></button>
          <button
            className="rx-preview-expand-btn"
            onClick={onExpand}
            aria-label={`Expand preview of ${project.name}`}
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="rx-preview-fullscreen" role="dialog" aria-modal="true" aria-label={`${project.name} preview`}>
          <div className="rx-preview-fullscreen-bar">
            <div className="rx-preview-fullscreen-chrome">
              <span className="rx-dot" style={{ background: "#ff1f7d" }}></span>
              <span className="rx-dot" style={{ background: "#febc2e" }}></span>
              <span className="rx-dot" style={{ background: "#28c840" }}></span>
              <span className="rx-preview-url rx-mono">{project.label}</span>
            </div>
            <div className="rx-preview-fullscreen-actions">
              <span className="rx-preview-hint rx-mono">
                click anywhere to open the live site <ArrowUpRight size={13} />
              </span>
              <button className="rx-preview-close" onClick={onClose} aria-label="Close preview">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="rx-preview-fullscreen-body">
            <div className="rx-preview-fullscreen-inner" style={{ height: project.previewHeight }}>
              <iframe src={project.url} title={project.name} tabIndex={-1} />
              <button
                className="rx-preview-clickcatcher"
                onClick={visit}
                aria-label={`Visit ${project.name} in a new tab`}
              ></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProjectPreview;
