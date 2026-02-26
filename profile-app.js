function ProfileApp() {
  React.useEffect(() => {
    if (!getToken()) window.location.href = "login.html";
  }, []);

  return (
    <div className="min-h-screen">
      <Header activePage="profile" />
      <main className="px-4 py-8">
        <UserProfile />
      </main>
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ProfileApp />);
