import React, { useState, useRef, useEffect } from 'react';
import { API_URL, sendChatMessage } from '../services/api';
import './AiAssistant.css';

const QUICK_PROMPTS = [
  { text: "What is Leukemia?", icon: "🩸" },
  { text: "How do tumor markers like CEA or CA-125 work?", icon: "🧪" },
  { text: "Explain the IoT Hardware simulation.", icon: "📡" },
  { text: "What is Grad-CAM explainability?", icon: "🧠" },
  { text: "How does EfficientNetV2B1 classify uterine cancer?", icon: "🔬" },
  { text: "Give me general cancer prevention tips.", icon: "🍏" }
];

const INITIAL_GREETING = {
  role: 'assistant',
  content: "Hello! I am **BlinderCare AI**, your clinical assistant for this project.\n\n" +
           "I can answer your questions about:\n" +
           "- 🩸 **Leukemia screening** and the blood microscopy CNN (EfficientNetV2B0)\n" +
           "- 🔬 **Uterine Cancer histopathology** and the classification CNN (EfficientNetV2B1)\n" +
           "- 🧪 **Tumor biomarkers** (CEA, CA-125, PSA) and Complete Blood Count (CBC) ranges\n" +
           "- 🧠 **Explainable AI** features (Grad-CAM overlays and SHAP feature impacts)\n" +
           "- 📡 **IoT Hardware simulation** and daily sync data streams\n\n" +
           "Feel free to ask a question or click one of the quick prompts below!"
};

function AiAssistant() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('blinder-care-chat.history.v1');
    return saved ? JSON.parse(saved) : [INITIAL_GREETING];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const bottomRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('blinder-care-chat.history.v1', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (textToSend) => {
    const msg = textToSend.trim();
    if (!msg) return;

    setError('');
    const userMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendChatMessage(msg);
      const assistantMsg = { role: 'assistant', content: data.reply };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message || 'Failed to connect to the medical assistant.');
      const backendLabel = API_URL || 'your deployed backend URL';
      // Add a fallback offline notice in the chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Offline Mode Error:** I could not reach the Flask server. Please make sure the backend API is reachable at ${backendLabel} to chat with me!`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    handleSend(input);
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      setMessages([INITIAL_GREETING]);
    }
  };

  const parseInlineBold = (line) => {
    if (!line) return "";
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="highlight">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMessageContent = (content) => {
    const lines = content.split('\n');
    let listOpen = false;
    const renderedElements = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Process Lists
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (!listOpen) {
          listOpen = true;
        }
        const text = trimmedLine.replace(/^[-*]\s+/, '');
        renderedElements.push(
          <li key={`li-${index}`} className="chat-li">
            {parseInlineBold(text)}
          </li>
        );
        return;
      }

      // Close list if it was open
      listOpen = false;

      // Process Headings
      if (trimmedLine.startsWith('### ')) {
        renderedElements.push(
          <h3 key={`h3-${index}`} className="chat-h3">
            {parseInlineBold(trimmedLine.replace('### ', ''))}
          </h3>
        );
      } else if (trimmedLine.startsWith('## ')) {
        renderedElements.push(
          <h2 key={`h2-${index}`} className="chat-h2">
            {parseInlineBold(trimmedLine.replace('## ', ''))}
          </h2>
        );
      } else if (trimmedLine.startsWith('# ')) {
        renderedElements.push(
          <h1 key={`h1-${index}`} className="chat-h1">
            {parseInlineBold(trimmedLine.replace('# ', ''))}
          </h1>
        );
      } else if (trimmedLine !== "") {
        // Plain Paragraph
        renderedElements.push(
          <p key={`p-${index}`} className="chat-p">
            {parseInlineBold(line)}
          </p>
        );
      }
    });

    return renderedElements;
  };

  return (
    <div className="page chat-page">
      <div className="container page-shell chat-shell">
        <header className="page-header card chat-hero">
          <div className="page-header-row">
            <div>
              <div className="page-breadcrumb">Patient Portal / Assistant</div>
              <h1 className="page-title">Clinical Support Assistant</h1>
              <p className="page-subtitle">
                Ask about biomarkers, explainability, device sync, or screening workflows in a guided clinical workspace.
              </p>
            </div>
            <div className="page-meta-row">
              <span className="page-meta-chip">Guided prompts</span>
              <span className="page-meta-chip">Clinical context</span>
              <span className="page-meta-chip">Chat history</span>
            </div>
          </div>
        </header>

        <div className="chat-container">
        
        {/* SIDEBAR FOR QUICK TIPS */}
        <aside className="chat-sidebar card">
          <div className="sidebar-head">
            <span className="sidebar-badge">Clinical support</span>
            <h2>OncoBot Companion</h2>
            <p className="text-muted text-sm">
              Your conversational guide for medical parameters, cancer types, deep learning architectures, and explainability.
            </p>
          </div>
          
          <div className="quick-prompts-section">
            <h3>Quick Topics</h3>
            <div className="quick-prompts-list">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button 
                  key={index} 
                  className="quick-prompt-btn"
                  onClick={() => handleSend(prompt.text)}
                  disabled={loading}
                >
                  <span className="prompt-icon">{prompt.icon}</span>
                  <span className="prompt-text">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-disclaimer">
            <strong>Disclaimer</strong>
            <p>
              OncoBot is a project screening demonstration. It provides educational answers based on clinical guidelines. Always consult medical experts for real health issues.
            </p>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <div className="chat-workspace card">
          <div className="chat-header">
            <div className="assistant-profile">
              <div className="avatar-shield">🩺</div>
              <div>
                <h2>BlinderCare AI Assistant</h2>
                <span className="status-indicator">
                  <span className="status-blink"></span>
                  Active diagnostics support
                </span>
              </div>
            </div>
            <button className="btn-clear-chat" onClick={handleClearHistory} title="Clear Chat History">
              🗑️ Clear Chat
            </button>
          </div>

          {/* CHAT MESSAGES PANEL */}
          <div className="chat-history">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🩺'}
                </div>
                <div className="message-bubble">
                  <div className="bubble-content">
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant loading">
                <div className="message-avatar">🩺</div>
                <div className="message-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            {error && <div className="chat-error-banner">⚠️ {error}</div>}
            <div ref={bottomRef} />
          </div>

          {/* CHAT INPUT BAR */}
          <form className="chat-input-area" onSubmit={handleSubmit}>
            <input 
              type="text" 
              className="chat-input"
              placeholder="Ask about tumor markers, CBC ranges, Grad-CAM, or leukemia..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              spellCheck="true"
            />
            <button className="chat-send-btn" type="submit" disabled={loading || !input.trim()}>
              {loading ? "..." : "Send ➔"}
            </button>
          </form>

        </div>

        </div>

      </div>
    </div>
  );
}

export default AiAssistant;
