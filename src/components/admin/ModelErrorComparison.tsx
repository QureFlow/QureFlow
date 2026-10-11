interface ModelRow {
  id: string;
  name: string;
  model: {
    baselineMae: number | null;
    modelMae: number | null;
    validationCount: number;
  };
}

export const ModelErrorComparison = ({ doctors }: { doctors: ModelRow[] }) => {
  const measured = doctors.filter(
    (doctor) =>
      doctor.model.validationCount > 0 &&
      doctor.model.baselineMae !== null &&
      doctor.model.modelMae !== null,
  );
  const maximum = Math.max(
    1,
    ...measured.flatMap((doctor) => [doctor.model.baselineMae!, doctor.model.modelMae!]),
  );
  return (
    <div className="px-5 pb-6 border-b border-slate-100">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <p className="text-xs font-medium text-slate-600">
          Prediction error by doctor · Lower is better
        </p>
        <div className="flex gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 bg-slate-300 rounded-sm" />
            Baseline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 bg-brand-600 rounded-sm" />
            Learned model
          </span>
        </div>
      </div>
      {!measured.length ? (
        <p className="text-xs text-slate-500">
          A comparison will appear when validation results are available.
        </p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-x-10 gap-y-5">
          {measured.map((doctor) => {
            const baseline = doctor.model.baselineMae!;
            const model = doctor.model.modelMae!;
            const improvement = baseline > 0 ? ((baseline - model) / baseline) * 100 : null;
            return (
              <div key={doctor.id}>
                <div className="flex justify-between gap-3 text-xs mb-2">
                  <p className="font-medium text-slate-800">{doctor.name}</p>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    {doctor.model.validationCount} validation cases
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${doctor.name}: baseline error ${baseline.toFixed(2)} minutes; model error ${model.toFixed(2)} minutes`}
                  className="space-y-1.5"
                >
                  {[
                    [baseline, 'bg-slate-300'],
                    [model, model <= baseline ? 'bg-brand-600' : 'bg-amber-500'],
                  ].map(([value, color], index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-50 rounded-sm overflow-hidden">
                        <div
                          className={`h-full rounded-sm ${color}`}
                          style={{ width: `${(Number(value) / maximum) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums w-14 text-right">
                        {Number(value).toFixed(2)} min
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  {improvement === null
                    ? 'Baseline error is zero; percentage comparison is unavailable.'
                    : `${Math.abs(improvement).toFixed(1)}% ${improvement >= 0 ? 'lower' : 'higher'} error on held-out consultations`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
