import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/settings/master-data", label: "Master Data" },
  { to: "/settings/integrations", label: "Integrations" },
];

export function SettingsTabs() {
  return (
    <div className="mb-4 flex gap-2 border-b border-slate-200 dark:border-slate-800">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-3 py-2 text-sm ${
              isActive
                ? "border-brand font-medium text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
