function LoginApp() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header activePage="login" />
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Login />
      </main>
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LoginApp />);
