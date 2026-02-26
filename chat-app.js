function ChatApp() {
  React.useEffect(() => {
    if (!getToken()) window.location.href = "login.html";
  }, []);

  return (
    <div className="min-h-screen h-screen flex flex-col">
      <Header activePage="chat" />
      <div className="flex-1 px-4 pb-4">
        <ChatInterface />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ChatApp />);
