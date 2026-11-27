import { useSearchParams } from 'react-router-dom';
import { useActor } from '../auth/useActor';
import { EmptyState, PageHeader } from '../components/Card';
import { Segmented } from '../components/Segmented';
import { AccessTab } from './settings/AccessTab';
import { BackupsTab } from './settings/BackupsTab';
import { DataTab } from './settings/DataTab';
import { LogTab } from './settings/LogTab';
import { ScoringTab } from './settings/ScoringTab';
import { SeasonTab } from './settings/SeasonTab';

const TABS = [
    { value: 'access', label: 'Access' },
    { value: 'scoring', label: 'Scoring' },
    { value: 'season', label: 'New season' },
    { value: 'data', label: 'Data' },
    { value: 'log', label: 'Change log' },
    { value: 'backups', label: 'Backups' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Admin settings, one tab per job (linkable with ?tab=). */
export function SettingsPage() {
    const actor = useActor();
    const [params, setParams] = useSearchParams();
    const asked = params.get('tab');
    const tab: Tab = TABS.some((t) => t.value === asked) ? (asked as Tab) : 'access';

    if (!actor) {
        return (
            <div>
                <PageHeader title="Settings" />
                <EmptyState
                    title="Sign in with Google"
                    body="Settings need a signed-in admin account, not test mode."
                />
            </div>
        );
    }

    return (
        <div>
            <PageHeader title="Settings" sub="Access, scoring, the end of the year, and keeping the data right." />
            <div className="settings-tabs">
                <Segmented
                    label="Settings"
                    value={tab}
                    options={TABS.map((t) => ({ value: t.value, label: t.label }))}
                    onChange={(v) => setParams(v === 'access' ? {} : { tab: v }, { replace: true })}
                />
            </div>
            <div key={tab} className="settings-panel">
                {tab === 'access' && <AccessTab actor={actor} />}
                {tab === 'scoring' && <ScoringTab />}
                {tab === 'season' && <SeasonTab />}
                {tab === 'data' && <DataTab />}
                {tab === 'log' && <LogTab actor={actor} />}
                {tab === 'backups' && <BackupsTab actor={actor} />}
            </div>
        </div>
    );
}
