import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import CompetitionForm from "../components/CompetitionForm";
import { buildCompetitionPayload, emptyFormValues } from "../utils/competitionForm";
import "./CreateCompetitionPage.css";

export default function CreateCompetitionPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (values) => {
    setError("");
    setSubmitting(true);
    try {
      const created = await api.createCompetition(buildCompetitionPayload(values));
      navigate(`/competitions/${created.id}`);
    } catch (err) {
      setError(err.message || "Could not create competition");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-competition-page">
      <button type="button" className="create-comp-back" onClick={() => navigate("/competitions")}>
        <ArrowLeft size={18} />
        Back to competitions
      </button>

      <div className="create-comp-card">
        <h1>Create competition</h1>
        <p className="create-comp-subtitle">Set up a new event for players to join</p>

        <CompetitionForm
          initialValues={emptyFormValues()}
          onSubmit={handleSubmit}
          submitLabel="Create competition"
          submitting={submitting}
          error={error}
        />
      </div>
    </div>
  );
}
