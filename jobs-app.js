function JobsApp() {
  React.useEffect(() => {
    // If user isn't signed in, send them to login
    if (!getToken()) window.location.href = "login.html";
  }, []);

  return (
    <div className="min-h-screen">
      <Header activePage="jobs" />
      <main className="px-4">
        <JobBoard />
      </main>
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<JobsApp />);
