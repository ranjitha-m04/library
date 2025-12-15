const AdminDashboard = () => {
  const [books, setBooks] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: '',
    description: '',
    borrow_policy: 'standard',
    expiry_hours: null
  });

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await axios.get(`${API}/admin/books`);
      setBooks(response.data);
    } catch (error) {
      toast.error('Failed to fetch books');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBook) {
        await axios.put(`${API}/admin/books/${editingBook.book_id}`, formData);
        toast.success('Book updated successfully');
      } else {
        await axios.post(`${API}/admin/books`, formData);
        toast.success('Book added successfully');
      }
      setIsDialogOpen(false);
      setEditingBook(null);
      setFormData({ title: '', author: '', category: '', description: '', borrow_policy: 'standard', expiry_hours: null });
      fetchBooks();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (bookId) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    try {
      await axios.delete(`${API}/admin/books/${bookId}`);
      toast.success('Book deleted successfully');
      fetchBooks();
    } catch (error) {
      toast.error('Failed to delete book');
    }
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      category: book.category,
      description: book.description || '',
      borrow_policy: book.borrow_policy,
      expiry_hours: book.expiry_hours
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingBook(null);
    setFormData({ title: '', author: '', category: '', description: '', borrow_policy: 'standard', expiry_hours: null });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Book Management</h1>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-book-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Book
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="book-form-dialog">
              <DialogHeader>
                <DialogTitle>{editingBook ? 'Edit Book' : 'Add New Book'}</DialogTitle>
                <DialogDescription>Fill in the book details below.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    data-testid="book-title-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    data-testid="book-author-input"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    data-testid="book-category-input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="book-description-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy">Borrow Policy</Label>
                  <Select
                    value={formData.borrow_policy}
                    onValueChange={(value) => setFormData({ ...formData, borrow_policy: value, expiry_hours: value === 'timed' ? 24 : null })}
                  >
                    <SelectTrigger data-testid="book-policy-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard (No auto-return)</SelectItem>
                      <SelectItem value="timed">Timed (Auto-return after hours)</SelectItem>
                      <SelectItem value="daily_return">Daily Return (Returns at 10 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.borrow_policy === 'timed' && (
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Hours</Label>
                    <Input
                      id="expiry"
                      data-testid="book-expiry-input"
                      type="number"
                      min="1"
                      value={formData.expiry_hours || ''}
                      onChange={(e) => setFormData({ ...formData, expiry_hours: parseInt(e.target.value) || null })}
                      required={formData.borrow_policy === 'timed'}
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button data-testid="submit-book-btn" type="submit">{editingBook ? 'Update' : 'Add'} Book</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="admin-books-grid">
          {books.map((book) => (
            <Card key={book.book_id} data-testid={`book-card-${book.book_id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{book.title}</CardTitle>
                    <CardDescription>{book.author}</CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button data-testid={`edit-book-${book.book_id}`} variant="ghost" size="icon" onClick={() => handleEdit(book)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button data-testid={`delete-book-${book.book_id}`} variant="ghost" size="icon" onClick={() => handleDelete(book.book_id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant="outline">{book.category}</Badge>
                  {book.is_borrowed && (
                    <Badge variant="destructive">Borrowed</Badge>
                  )}
                  <div className="text-sm text-gray-600 flex items-center">
                    {book.borrow_policy === 'timed' && (
                      <><Clock className="h-4 w-4 mr-1" /> {book.expiry_hours}h expiry</>
                    )}
                    {book.borrow_policy === 'daily_return' && (
                      <><Calendar className="h-4 w-4 mr-1" /> Returns at 10 PM</>
                    )}
                    {book.borrow_policy === 'standard' && 'Standard Policy'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
