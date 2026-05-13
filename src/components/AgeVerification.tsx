import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

const STORAGE_KEY = "streamio.ageVerified";

interface AgeVerificationProps {
  onVerified: () => void;
}

export const AgeVerification = ({ onVerified }: AgeVerificationProps) => {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem(STORAGE_KEY);
    if (!verified) {
      setVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      onVerified();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setHiding(true);
    document.body.style.overflow = "";
    setTimeout(() => {
      setVisible(false);
      onVerified();
    }, 400);
  };

  const handleExit = () => {
    try {
      window.location.href = "https://www.google.com";
    } catch {
      window.close();
    }
  };

  if (!visible) return null;

  return (
    <div
      className={`age-gate-overlay ${hiding ? "age-gate-out" : "age-gate-in"}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="age-gate-title"
    >
      <div className={`age-gate-box ${hiding ? "age-gate-box-out" : "age-gate-box-in"}`}>
        <div className="age-gate-glow" aria-hidden="true" />

        <div className="age-gate-icon-wrap">
          <span className="age-gate-icon-ring" aria-hidden="true" />
          <ShieldAlert className="age-gate-icon" aria-hidden="true" />
        </div>

        <p className="age-gate-label">18+ CONTENT WARNING</p>

        <h2 id="age-gate-title" className="age-gate-title">
          Adults Only
        </h2>

        <p className="age-gate-body">
          This website contains mature media content intended for audiences aged{" "}
          <strong className="age-gate-strong">18 and above</strong>. By continuing, users confirm
          they are legally permitted to access this platform according to their local laws and
          regulations.
        </p>

        <div className="age-gate-divider" aria-hidden="true" />

        <div className="age-gate-actions">
          <button
            className="age-gate-btn-accept"
            onClick={handleAccept}
            autoFocus
          >
            <span className="age-gate-btn-shimmer" aria-hidden="true" />
            I Am 18+
          </button>
          <button
            className="age-gate-btn-exit"
            onClick={handleExit}
          >
            Exit
          </button>
        </div>

        <p className="age-gate-footnote">
          Your verification is saved — you won't be asked again.
        </p>
      </div>
    </div>
  );
};
