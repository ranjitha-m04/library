const UserDashboard = () => {
  const [books, setBooks] = useState([]);
  const [myBooks, setMyBooks] = useState([]);
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    fetchBooks();
    fetchMyBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API}/books`);
      setBooks(response.data);
    } catch (error) {
      toast.error('Failed to fetch books');
    }
  };

  const fetchMyBooks = async () => {
    try {
      const response = await axios.get(`${API}/my-books`);
      setMyBooks(response.data);
    } catch (error) {
      toast.error('Failed to fetch your books');
    }
  };

  const handleBorrow = async (bookId) => {
    try {
      const response = await axios.post(`${API}/borrow/${bookId}`);
      toast.success('Book borrowed successfully');
      if (response.data.return_by) {
        toast.info(`Book will auto-return at: ${new Date(response.data.return_by).toLocaleString()}`);
      }
      fetchBooks();
      fetchMyBooks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to borrow book');
    }
  };

  const handleReturn = async (bookId) => {
    try {
      await axios.post(`${API}/return/${bookId}`);
      toast.success('Book returned successfully');
      fetchBooks();
      fetchMyBooks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to return book');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Library Dashboard</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="user-tabs">
            <TabsTrigger data-testid="browse-tab" value="browse">Browse Books</TabsTrigger>
            <TabsTrigger data-testid="my-books-tab" value="my-books">My Books</TabsTrigger>
          </TabsList>
          
          <TabsContent value="browse" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="browse-books-grid">
              {books.map((book) => (
                <Card key={book.book_id} data-testid={`browse-book-${book.book_id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg">{book.title}</CardTitle>
                    <CardDescription>{book.author}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Badge variant="outline">{book.category}</Badge>
                      {book.description && (
                        <p className="text-sm text-gray-600">{book.description}</p>
                      )}
                      <div className="text-sm text-gray-600 flex items-center">
                        {book.borrow_policy === 'timed' && (
                          <><Clock className="h-4 w-4 mr-1" /> Auto-return in {book.expiry_hours}h</>
                        )}
                        {book.borrow_policy === 'daily_return' && (
                          <><Calendar className="h-4 w-4 mr-1" /> Returns at 10 PM daily</>
                        )}
                        {book.borrow_policy === 'standard' && 'Manual return required'}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    {book.is_borrowed ? (
                      <Badge variant="secondary" className="w-full justify-center">Currently Borrowed</Badge>
                    ) : (
                      <Button data-testid={`borrow-btn-${book.book_id}`} className="w-full" onClick={() => handleBorrow(book.book_id)}>
                        <BookOpen className="h-4 w-4 mr-2" />
                        Borrow Book
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="my-books" className="mt-6">
            <div className="space-y-4" data-testid="my-books-list">
              {myBooks.filter(record => record.status === 'active').length > 0 ? (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-gray-900">Currently Borrowed</h2>
                  {myBooks.filter(record => record.status === 'active').map((record) => (
                    <Card key={record.record_id} data-testid={`active-borrow-${record.record_id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{record.book_title}</CardTitle>
                            <CardDescription>
                              Borrowed: {new Date(record.borrowed_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <Badge>Active</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {record.return_by && (
                          <p className="text-sm text-gray-600">
                            Auto-return: {new Date(record.return_by).toLocaleString()}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button data-testid={`return-btn-${record.book_id}`} className="w-full" onClick={() => handleReturn(record.book_id)}>
                          Return Book
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card data-testid="no-active-books">
                  <CardContent className="py-8 text-center text-gray-500">
                    You haven't borrowed any books yet.
                  </CardContent>
                </Card>
              )}
              
              {myBooks.filter(record => record.status !== 'active').length > 0 && (
                <div className="space-y-3 mt-8">
                  <h2 className="text-xl font-semibold text-gray-900">Borrow History</h2>
                  {myBooks.filter(record => record.status !== 'active').map((record) => (
                    <Card key={record.record_id} data-testid={`history-borrow-${record.record_id}`}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{record.book_title}</CardTitle>
                            <CardDescription>
                              Borrowed: {new Date(record.borrowed_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <Badge variant="outline">
                            {record.status === 'returned' ? 'Returned' : 'Auto-returned'}
                          </Badge>
                        </div>
                      </CardHeader>
                      {record.returned_at && (
                        <CardContent>
                          <p className="text-sm text-gray-600">
                            Returned: {new Date(record.returned_at).toLocaleDateString()}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <UserDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
