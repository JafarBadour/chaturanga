import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import CompetitionForm from "../components/CompetitionForm";
import { buildCompetitionPayload, formValuesFromCompetition } from "../utils/competitionForm";
import "./CreateCompetitionPage.css";

export default function EditCompetitionPage() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [initialValues, setInitialValues] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .getCompetition(competitionId)
      .then((comp) => {
        if (!comp.can_edit) {
          navigate(`/competitions/${competitionId}`, { replace: true });
          return;
        }
        setInitialValues(formValuesFromCompetition(comp));
      })
      .catch((err) => {
        setError(err.message || "Could not load competition");
      })
      .finally(() => setLoading(false));
  }, [competitionId, navigate]);

  const handleSubmit = async (values) => {
    setError("");
    setSubmitting(true);
    try {
      await api.updateCompetition(competitionId, buildCompetitionPayload(values));
      navigate(`/competitions/${competitionId}`);
    } catch (err) {
      setError(err.message || "Could not save changes");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-competition-page">
      <button
        type="button"
        className="create-comp-back"
        onClick={() => navigate(`/competitions/${competitionId}`)}
      >
        <ArrowLeft size={18} />
        Back to competition
      </button>

      <div className="create-comp-card">
        <h1>Edit competition</h1>
        <p className="create-comp-subtitle">Changes can be made until the event starts</p>

        {loading && <p className="create-comp-hint">Loading…</p>}
        {!loading && error && !initialValues && (
          <p className="create-comp-error">{error}</p>
        )}
        {!loading && initialValues && (
          <CompetitionForm
            key={competitionId}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            submitLabel="Save changes"
            submitting={submitting}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
