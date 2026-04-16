import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Tag {
  repo: string;
  tag: string;
  status: 'pending' | 'building' | 'success' | 'failed';
  deb_path: string;
  rpm_path: string;
  updated_at: string;
}

interface GroupedTags {
  [prefix: string]: Tag[];
}

interface RepoGroup {
  [repo: string]: GroupedTags;
}

const API_BASE = 'http://localhost:3001';

function App() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const fetchTags = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tags`);
      setTags(res.data);
    } catch (err) {
      console.error('API Error', err);
    }
  };

  useEffect(() => {
    fetchTags();
    const interval = setInterval(fetchTags, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Hierarchical grouping: Repo -> Version Prefix -> Tags
  const grouped: RepoGroup = tags
    .filter(item => item.status === 'success')
    .reduce((acc: RepoGroup, item) => {
      if (!acc[item.repo]) acc[item.repo] = {};
      
      const parts = item.tag.replace(/^v/, '').split('.');
      const prefix = parts.length >= 2 ? `v${parts[0]}.${parts[1]}.x` : 'Other';
      
      if (!acc[item.repo][prefix]) acc[item.repo][prefix] = [];
      acc[item.repo][prefix].push(item);
      return acc;
    }, {});

  const sortedRepos = Object.keys(grouped).sort();

  return (
    <div style={{ 
      margin: '0',
      padding: '3rem', 
      background: '#FFFFFF', 
      minHeight: '100vh', 
      width: '100vw',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      color: '#000000',
      textAlign: 'left' 
    }}>
      <h1 style={{ fontSize: '18px', fontWeight: '500', margin: '0 0 4px 0' }}>Orion Package Builder & Distribution</h1>
      <p style={{ margin: '0 0 40px 0', color: '#666', fontSize: '13px' }}>Multi-repository automated delivery system.</p>

      <div style={{ margin: 0, padding: 0 }}>
        {sortedRepos.map((repo) => (
          <div key={repo} style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              📦 {repo}
            </h2>
            
            {Object.keys(grouped[repo]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((prefix) => {
              const folderKey = `${repo}-${prefix}`;
              return (
                <div key={prefix} style={{ marginBottom: '12px', paddingLeft: '8px' }}>
                  <div 
                    onClick={() => toggleFolder(folderKey)}
                    style={{ 
                      cursor: 'pointer', 
                      fontSize: '14px', 
                      color: '#000', 
                      fontWeight: '500',
                      userSelect: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ color: '#999', fontSize: '10px', width: '12px' }}>
                      {expandedFolders[folderKey] ? '▼' : '▶'}
                    </span>
                    {prefix}/
                  </div>

                  {expandedFolders[folderKey] && (
                    <ul style={{ listStyleType: 'none', padding: '8px 0 8px 24px', margin: 0 }}>
                      {grouped[repo][prefix].map((item) => (
                        <li key={item.tag} style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                            {item.tag} — {new Date(item.updated_at).toLocaleDateString()}
                          </div>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <a 
                              href={`${API_BASE}${item.deb_path}`} 
                              style={{ color: '#0000EE', textDecoration: 'none', fontSize: '13px' }}
                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                              download
                            >
                              debian_package
                            </a>
                            <a 
                              href={`${API_BASE}${item.rpm_path}`} 
                              style={{ color: '#0000EE', textDecoration: 'none', fontSize: '13px' }}
                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                              download
                            >
                              redhat_package
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {tags.some(item => item.status === 'building') && (
          <div style={{ color: '#0066cc', fontStyle: 'italic', fontSize: '13px', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="animate-pulse">●</span> Building new versions...
          </div>
        )}

        {sortedRepos.length === 0 && !tags.some(item => item.status === 'building') && (
          <div style={{ color: '#999', fontStyle: 'italic', fontSize: '13px' }}>No repositories or builds currently available.</div>
        )}
      </div>
    </div>
  );
}

export default App;
