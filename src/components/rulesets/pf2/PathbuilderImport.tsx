import { useState } from 'react';
import type { PF2CharacterSheet } from '../../../../shared/rulesets/pf2/characterSheet';
import { fetchFromAPI, parseFromFile } from '../../../services/pathbuilderImporter';

interface PathbuilderImportProps {
  onImport: (character: PF2CharacterSheet) => void;
  onCancel: () => void;
}

export const PathbuilderImport = ({ onImport, onCancel }: PathbuilderImportProps) => {
  const [activeTab, setActiveTab] = useState<'id' | 'file'>('id');
  const [characterId, setCharacterId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PF2CharacterSheet | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const handleFetchById = async () => {
    if (!characterId) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setWarnings([]);
    
    const result = await fetchFromAPI(characterId);
    setLoading(false);
    
    if (result.success) {
      setPreview(result.character);
      setWarnings(result.warnings);
    } else {
      setError(result.error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setPreview(null);
    setWarnings([]);

    const result = await parseFromFile(file);
    setLoading(false);
    
    if (result.success) {
      setPreview(result.character);
      setWarnings(result.warnings);
    } else {
      setError(result.error);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onImport(preview);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content character-modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Import from Pathbuilder 2e</h2>
        </div>

        <div className="char-section">
          <div className="template-buttons">
            <button 
              className={`template-btn ${activeTab === 'id' ? 'active' : ''}`}
              onClick={() => setActiveTab('id')}
            >
              Import by ID
            </button>
            <button 
              className={`template-btn ${activeTab === 'file' ? 'active' : ''}`}
              onClick={() => setActiveTab('file')}
            >
              Upload JSON
            </button>
          </div>
        </div>

        <div className="char-section">
          {activeTab === 'id' ? (
            <div className="import-input-group">
              <p className="help-text" style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
                Enter your Pathbuilder 2e character ID (found in the URL: pathbuilder2e.com/launch.html?build=YOUR_ID)
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="char-input"
                  placeholder="e.g. 123456"
                  value={characterId}
                  onChange={(e) => setCharacterId(e.target.value)}
                />
                <button 
                  className="primary" 
                  onClick={handleFetchById}
                  disabled={loading || !characterId}
                >
                  {loading ? 'Fetching...' : 'Fetch'}
                </button>
              </div>
            </div>
          ) : (
            <div className="import-input-group">
              <p className="help-text" style={{ marginBottom: '10px', fontSize: '0.9em', color: '#888' }}>
                Upload a Pathbuilder 2e JSON export file
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={loading}
                className="char-input"
              />
              {loading && <span style={{ marginLeft: '10px' }}>Loading...</span>}
            </div>
          )}
        </div>

        {error && (
          <div className="char-section" style={{ color: '#ff4444', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {preview && (
          <div className="char-section preview-section" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Preview</h3>
            
            <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{preview.name}</div>
                <div style={{ color: '#aaa' }}>Level {preview.level} {preview.class}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>HP: {preview.derived.hitPoints}</div>
                <div>AC: {preview.derived.armorClass}</div>
                <div>Speed: {preview.derived.speed / 5} hexes</div>
              </div>
            </div>

            <div className="preview-abilities" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '15px' }}>
              {Object.entries(preview.abilities).map(([key, value]) => (
                <div key={key} style={{ background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.8em', color: '#888', textTransform: 'uppercase' }}>{key.slice(0, 3)}</div>
                  <div style={{ fontWeight: 'bold' }}>{value}</div>
                </div>
              ))}
            </div>

            {preview.weapons.length > 0 && (
              <div className="preview-weapons" style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '0.9em', color: '#888', marginBottom: '5px' }}>Weapons</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {preview.weapons.map(w => (
                    <span key={w.id} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.9em' }}>
                      {w.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="preview-warnings" style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 165, 0, 0.15)', borderRadius: '4px', borderLeft: '3px solid orange' }}>
                <div style={{ color: 'orange', fontWeight: 'bold', marginBottom: '5px' }}>Warnings</div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9em', color: '#ddd' }}>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button 
            className="primary" 
            onClick={handleConfirm}
            disabled={!preview}
          >
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};
