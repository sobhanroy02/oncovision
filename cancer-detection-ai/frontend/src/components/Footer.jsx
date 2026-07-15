function Footer() {
  return (
    <footer style={{
      background: '#0f2547',
      color: 'rgba(255,255,255,0.7)',
      padding: '32px 0',
      textAlign: 'center',
      fontSize: '0.9rem',
      marginTop: '60px',
    }}>
      <div className="container">
        <p style={{ margin: 0 }}>
          <strong style={{ color: 'white' }}>AI Cancer Detection System</strong>
          {' '}— built by Geeky Blinders (AIML Sem 7)
        </p>
      </div>
    </footer>
  );
}

export default Footer;