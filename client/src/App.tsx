import { useEffect, useState } from 'react';
import axios from 'axios';

interface Tag {
  repo: string;
  tag: string;
  status: 'pending' | 'building' | 'success' | 'failed';
  deb_path: string;
  rpm_path: string;
  docker_image?: string;
  updated_at: string;
}

interface GroupedTags {
  [prefix: string]: Tag[];
}

interface RepoGroup {
  [repo: string]: GroupedTags;
}

function App() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const fetchTags = async () => {
    try {
      const res = await axios.get('/api/tags');
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
    setExpandedFolders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Filter tags based on search term and success status
  const filteredTags = tags.filter(
    (item) =>
      item.status === 'success' &&
      (item.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.repo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Hierarchical grouping: Repo -> Version Prefix -> Tags
  const grouped: RepoGroup = filteredTags.reduce((acc: RepoGroup, item) => {
    if (!acc[item.repo]) acc[item.repo] = {};

    const parts = item.tag.replace(/^v/, '').split('.');
    const prefix = parts.length >= 2 ? `v${parts[0]}.${parts[1]}.x` : 'Other';

    if (!acc[item.repo][prefix]) acc[item.repo][prefix] = [];
    acc[item.repo][prefix].push(item);
    return acc;
  }, {});

  const sortedRepos = Object.keys(grouped).sort();

  return (
    <div
      style={{
        margin: '0',
        padding: '3rem',
        background: '#FFFFFF',
        minHeight: '100vh',
        width: '100vw',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#000000',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '40px',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #444 0%, #000 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="#E0E0E0"
              />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '500', margin: '0 0 4px 0' }}>
              Orion Package Builder & Distribution
            </h1>
            <p style={{ margin: '0', color: '#666', fontSize: '13px' }}>
              Multi-repository automated delivery system.
            </p>
          </div>
        </div>

        <input
          type="text"
          placeholder="Search repos or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '8px 14px',
            fontSize: '12px',
            border: '1px solid #eee',
            borderRadius: '6px',
            outline: 'none',
            background: '#f9f9f9',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#ccc';
            e.currentTarget.style.background = '#fff';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#eee';
            e.currentTarget.style.background = '#f9f9f9';
          }}
        />
      </div>

      <div style={{ margin: 0, padding: 0 }}>
        {sortedRepos.map((repo) => (
          <div key={repo} style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: '600',
                marginBottom: '16px',
                borderBottom: '1px solid #eee',
                paddingBottom: '8px',
              }}
            >
              📦 {repo}
            </h2>

            {Object.keys(grouped[repo])
              .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
              .map((prefix) => {
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
                        gap: '8px',
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
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                              {item.deb_path && (
                                <a
                                  href={item.deb_path}
                                  style={{
                                    color: '#0000EE',
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                  }}
                                  onMouseOver={(e) =>
                                    (e.currentTarget.style.textDecoration = 'underline')
                                  }
                                  onMouseOut={(e) =>
                                    (e.currentTarget.style.textDecoration = 'none')
                                  }
                                  download
                                >
                                  debian_package
                                </a>
                              )}
                              {item.rpm_path && (
                                <a
                                  href={item.rpm_path}
                                  style={{
                                    color: '#0000EE',
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                  }}
                                  onMouseOver={(e) =>
                                    (e.currentTarget.style.textDecoration = 'underline')
                                  }
                                  onMouseOut={(e) =>
                                    (e.currentTarget.style.textDecoration = 'none')
                                  }
                                  download
                                >
                                  redhat_package
                                </a>
                              )}
                              {item.docker_image && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', color: '#444' }}>
                                    🐳 {item.docker_image}
                                  </span>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        `docker pull ${item.docker_image}`
                                      );
                                      alert('Copied pull command!');
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      background: '#f0f0f0',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    copy
                                  </button>
                                </div>
                              )}
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

        {tags.some((item) => item.status === 'building') && (
          <div
            style={{
              color: '#0066cc',
              fontStyle: 'italic',
              fontSize: '13px',
              marginTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span className="animate-pulse">●</span> Building new versions...
          </div>
        )}

        {sortedRepos.length === 0 && !tags.some((item) => item.status === 'building') && (
          <div style={{ color: '#999', fontStyle: 'italic', fontSize: '13px' }}>
            No repositories or builds currently available.
          </div>
        )}
      </div>

      <footer
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '0',
          right: '0',
          textAlign: 'center',
          fontSize: '12px',
          color: '#888',
        }}
      >
        <a
          href="https://github.com/muhfalihr/Orion.git"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#666',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#000')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
        >
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}

export default App;
