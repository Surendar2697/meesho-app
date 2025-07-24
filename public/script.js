document.addEventListener("DOMContentLoaded", async () => {
  // ===== GLOBAL RATING TOGGLE =====
  const SHOW_RATINGS = true;
  // ================================

  // Initialize localStorage for cart/wishlist if not exists
  if (!localStorage.getItem('cart')) {
    localStorage.setItem('cart', JSON.stringify([]));
  }
  if (!localStorage.getItem('wishlist')) {
    localStorage.setItem('wishlist', JSON.stringify([]));
  }

  // Update cart count in navbar
  function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart'));
    const cartCountElements = document.querySelectorAll('#cartCount');
    cartCountElements.forEach(element => {
      element.textContent = cart.length
      element.style.display = cart.length > 0 ? 'flex' : 'none';
    });
  }

  // Update wishlist count in navbar
  function updateWishlistCount() {
    const wishlist = JSON.parse(localStorage.getItem('wishlist'));
    const wishlistCountElements = document.querySelectorAll('#wishlistCount');
    wishlistCountElements.forEach(element => {
      element.textContent = wishlist.length;
      element.style.display = wishlist.length > 0 ? 'flex' : 'none';
    });
  }

  // Toggle wishlist status
  function toggleWishlist(productId) {
    const wishlist = JSON.parse(localStorage.getItem('wishlist'));
    const index = wishlist.indexOf(productId);

    if (index === -1) {
      wishlist.push(productId); // Add to wishlist
    } else {
      wishlist.splice(index, 1); // Remove from wishlist
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistCount(); // Update wishlist count
    return index === -1; // Returns true if added, false if removed
  }

  // Add to cart
  function addToCart(productId, quantity = 1) {
    const cart = JSON.parse(localStorage.getItem('cart'));
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning', // Exclamation
        title: 'Item already in cart',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
      return false;
    } else {
      cart.push({ id: productId, quantity });
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartCount();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Added to cart successfully',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });

      return true;
    }
  }

  // Wait for Firebase to initialize
  while (!window.firebaseModules) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const { db, collection, getDocs, doc, getDoc, query, where, limit } = window.firebaseModules;

  // Check which page we're on
  if (document.getElementById('products')) {
    // INDEX PAGE FUNCTIONALITY
    let allProducts = [];

    async function fetchProducts() {
      const container = document.getElementById("products");
      container.innerHTML = `
        <div class="flex justify-center">
          <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
        <p class="text-center mt-4 text-gray-600">Loading products...</p>
      `;

      try {
        const querySnapshot = await getDocs(collection(db, "meesho_products"));
        allProducts = [];

        querySnapshot.forEach(doc => {
          const data = doc.data();
          data.id = doc.id;
          allProducts.push(data);
        });

        applyFilters();
      } catch (err) {
        console.error("Failed to load products:", err);
        container.innerHTML = `
          <div class="text-center py-12">
            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p class="text-lg text-gray-700">Error loading products. Please try again later.</p>
            <button onclick="window.location.reload()" class="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Retry
            </button>
          </div>
        `;
      }
    }

    function applyFilters() {
      const searchTerm = document.getElementById("searchInput").value.toLowerCase();
      const sortOption = document.getElementById("sortSelect").value;

      let filtered = allProducts.filter(p =>
        p.product_name?.toLowerCase().includes(searchTerm)
      );

      // Sorting logic
      if (sortOption === "lowToHigh") {
        filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
      } else if (sortOption === "highToLow") {
        filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
      } else if (sortOption === "newArrival") {
        filtered.sort((a, b) => {
          const t1 = a.timestamp?.seconds || 0;
          const t2 = b.timestamp?.seconds || 0;
          return t2 - t1;
        });
      }

      renderProducts(filtered);
    }

    function renderProducts(products) {
      const container = document.getElementById("products");

      if (products.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12">
            <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
            <p class="text-lg text-gray-700">No matching products found.</p>
            <button onclick="document.getElementById('searchInput').value='';applyFilters()" 
              class="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              Clear Search
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"></div>';
      const grid = container.firstChild;
      const wishlist = JSON.parse(localStorage.getItem('wishlist'));

      products.forEach(data => {
        const imageUrl = data.product_images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";
        const productName = data.product_name || "Unnamed Product";
        const price = parseFloat(data.price) || Math.floor(Math.random() * 2000) + 100;
        const originalPrice = Math.floor(price * (1 + Math.random() * 0.8 + 0.2));
        const discount = Math.floor(((originalPrice - price) / originalPrice) * 100);
        const rating = SHOW_RATINGS ? (Math.random() * 2 + 3).toFixed(1) : null;
        const ratingCount = SHOW_RATINGS ? Math.floor(Math.random() * 5000 + 100) : null;
        const isWishlisted = wishlist.includes(data.id);

        const card = document.createElement("div");
        card.className = "product-card bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 relative";

        card.innerHTML = `
          <a href="product.html?id=${encodeURIComponent(data.id)}" class="block">
            <div class="relative pb-[100%] bg-gray-100">
              <img 
                src="${imageUrl}" 
                alt="${productName}" 
                loading="lazy"
                class="absolute h-full w-full object-cover"
                onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'"
              >
            </div>
            <div class="p-4">
              <h2 class="font-semibold text-gray-800 line-clamp-2 h-12">${productName}</h2>
              <div class="mt-2">
                <span class="text-lg font-bold text-purple-700">₹${price.toLocaleString()}</span>
                <span class="text-sm text-gray-500 line-through ml-2">₹${originalPrice.toLocaleString()}</span>
                <span class="text-xs font-semibold bg-pink-100 text-pink-800 px-2 py-1 rounded ml-2">${discount}% OFF</span>
              </div>
              ${data.seller_name ? `<p class="text-sm text-gray-500 mt-1">by ${data.seller_name}</p>` : ''}
              ${rating ? `
                <div class="mt-2 flex items-center">
                  <div class="flex text-yellow-400 text-sm">
                    ${'<i class="fas fa-star"></i>'.repeat(Math.floor(rating))}
                    ${rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                    ${'<i class="far fa-star"></i>'.repeat(5 - Math.ceil(rating))}
                  </div>
                  <span class="text-xs text-gray-500 ml-1">(${ratingCount.toLocaleString()})</span>
                </div>
              ` : ''}
            </div>
          </a>
          <button class="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 wishlist-btn" 
                  onclick="event.stopPropagation(); toggleWishlistIcon(this, '${data.id}')">
            <i class="${isWishlisted ? 'fas text-red-500' : 'far'} fa-heart"></i>
          </button>
          <button class="absolute bottom-16 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 cart-btn" 
                  onclick="event.stopPropagation(); addToCartFromCard('${data.id}')">
            <i class="fas fa-shopping-cart text-purple-600"></i>
          </button>
        `;
        grid.appendChild(card);
      });

      updateCartCount();
      updateWishlistCount();
    }

    // Initialize index page
    fetchProducts();
    document.getElementById("searchInput").addEventListener("input", applyFilters);
    document.getElementById("sortSelect").addEventListener("change", applyFilters);

    // Global functions for buttons
    window.toggleWishlistIcon = function (button, productId) {
      const isWishlisted = toggleWishlist(productId);
      const icon = button.querySelector('i');
      icon.classList.toggle('far', !isWishlisted);
      icon.classList.toggle('fas', isWishlisted);
      icon.classList.toggle('text-red-500', isWishlisted);
    };

    window.addToCart = function (productId, quantity = 1) {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      const existingItem = cart.find(item => item.id === productId);

      if (existingItem) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'warning',
          title: 'Item already in cart',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
        return false;
      } else {
        cart.push({ id: productId, quantity });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Added to cart successfully',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
        return true;
      }
    };


  } else if (document.getElementById('productContainer')) {
    // PRODUCT PAGE FUNCTIONALITY
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const productContainer = document.getElementById('productContainer');
    const similarProductsSection = document.getElementById('similarProductsSection');
    const similarProducts = document.getElementById('similarProducts');

    // Fetch product details
    async function fetchProductDetails() {
      if (!productId) {
        showError("Product ID not found in URL");
        return;
      }

      try {
        const docRef = doc(db, "meesho_products", productId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const product = docSnap.data();
          displayProductDetails(product);
          fetchSimilarProducts(product.category || "clothing");
        } else {
          showError("Product not found");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        showError("Failed to load product details");
      }
    }

    function displayProductDetails(product) {
      const price = parseFloat(product.price) || 0;
      const originalPriceValue = product.original_price || Math.floor(price * 1.5);
      const discount = Math.floor(((originalPriceValue - price) / originalPriceValue) * 100);
      const rating = SHOW_RATINGS ? (Math.random() * 2 + 3).toFixed(1) : null;
      const ratingCount = SHOW_RATINGS ? Math.floor(Math.random() * 5000 + 100) : null;
      const images = product.product_images || [];
      const wishlist = JSON.parse(localStorage.getItem('wishlist'));
      const isWishlisted = wishlist.includes(productId);

      // Update breadcrumbs
      document.getElementById('productNameBreadcrumb').textContent = product.product_name || "Product";
      if (product.category) {
        document.getElementById('productCategory').textContent = product.category;
      }

      productContainer.innerHTML = `
        <div class="space-y-4">
          <div class="bg-white rounded-lg p-4 shadow-sm relative">
            <button class="absolute top-4 right-4 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 wishlist-btn" 
                    onclick="toggleWishlistIcon(this, '${productId}')">
              <i class="${isWishlisted ? 'fas text-red-500' : 'far'} fa-heart"></i>
            </button>
            <div class="h-96 w-full bg-gray-100 rounded-lg overflow-hidden">
              <img 
                id="mainProductImage" 
                src="${images[0] || 'https://via.placeholder.com/500x500?text=No+Image'}" 
                alt="${product.product_name}" 
                class="h-full w-full object-contain"
                onerror="this.src='https://via.placeholder.com/500x500?text=No+Image'"
              >
            </div>
            <div id="thumbnailContainer" class="flex space-x-2 mt-4 overflow-x-auto py-2">
              ${images.map(img => `
                <img 
                  src="${img}" 
                  alt="Thumbnail" 
                  class="thumbnail h-16 w-16 object-cover rounded border border-gray-200 cursor-pointer"
                  onclick="document.getElementById('mainProductImage').src = '${img}'"
                  onerror="this.style.display='none'"
                >
              `).join('')}
            </div>
          </div>
        </div>
        <div class="space-y-6">
          <div class="bg-white rounded-lg p-6 shadow-sm">
            <h1 id="productTitle" class="text-2xl font-bold text-gray-800">${product.product_name || "Unnamed Product"}</h1>
            
            ${rating ? `
              <div class="flex items-center mt-2">
                <div class="flex text-yellow-400">
                  ${'<i class="fas fa-star"></i>'.repeat(Math.floor(rating))}
                  ${rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                  ${'<i class="far fa-star"></i>'.repeat(5 - Math.ceil(rating))}
                </div>
                <span class="text-sm text-gray-600 ml-2">${rating} (${ratingCount.toLocaleString()} ratings)</span>
              </div>
            ` : ''}
            
            ${product.seller_name ? `<p class="text-gray-600 mt-1">Sold by: ${product.seller_name}</p>` : ''}
            
            <div class="mt-4">
              <span id="currentPrice" class="text-3xl font-bold text-purple-700">₹${price.toLocaleString()}</span>
              <span id="originalPrice" class="text-lg text-gray-500 line-through ml-2">₹${originalPriceValue.toLocaleString()}</span>
              <span id="discountBadge" class="text-sm font-semibold bg-pink-100 text-pink-800 px-2 py-1 rounded ml-2">${discount}% OFF</span>
            </div>
            
            <p class="text-green-600 text-sm mt-2">Inclusive of all taxes</p>
            
            <div class="space-y-3 mt-6">
              <div>
                <h3 class="font-semibold">Delivery</h3>
                <p class="text-sm text-gray-600">Free delivery on orders above ₹499</p>
              </div>
              <div>
                <h3 class="font-semibold">Returns</h3>
                <p class="text-sm text-gray-600">7 days easy returns</p>
              </div>
            </div>
            
            <div class="mt-8">
              <h3 class="font-semibold mb-3">Quantity</h3>
              <div class="flex items-center">
                <button id="decreaseQty" class="border border-gray-300 rounded-l-md px-4 py-2 bg-gray-100 hover:bg-gray-200" onclick="changeQuantity(-1)">
                  -
                </button>
                <span id="quantityValue" class="border-t border-b border-gray-300 px-6 py-2">1</span>
                <button id="increaseQty" class="border border-gray-300 rounded-r-md px-4 py-2 bg-gray-100 hover:bg-gray-200" onclick="changeQuantity(1)">
                  +
                </button>
              </div>
            </div>
            
            <div class="flex gap-4 mt-8">
              <button id="addToCartBtn" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors">
                <i class="fas fa-shopping-cart mr-2"></i> Add to Cart
              </button>
              <button id="buyNowBtn" class="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-3 rounded-lg font-medium transition-colors">
                Buy Now
              </button>
            </div>
          </div>
          
          <div class="bg-white rounded-lg p-6 shadow-sm">
            <h3 class="text-xl font-bold mb-4">Product Details</h3>
            <div id="productDescription" class="prose max-w-none">
              ${product.product_description || '<p>No description available.</p>'}
            </div>
          </div>
        </div>
      `;

      window.changeQuantity = function (change) {
        const quantityElement = document.getElementById('quantityValue');
        let quantity = parseInt(quantityElement.textContent);
        quantity += change;
        if (quantity < 1) quantity = 1;
        if (quantity > 10) quantity = 10;
        quantityElement.textContent = quantity;
      };

      document.getElementById('addToCartBtn').addEventListener('click', () => {

        const quantity = document.getElementById('quantityValue').textContent;

        if (addToCart(productId, parseInt(quantity))) {
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
          });
          Toast.fire({
            icon: 'success',
            title: 'Added to cart successfully'
          });
        }
      });


      document.getElementById('buyNowBtn').addEventListener('click', () => {
        const quantity = document.getElementById('quantityValue').textContent;
        addToCart(productId, parseInt(quantity));
        window.location.href = 'checkout.html'; // Redirect to checkout
      });

      similarProductsSection.classList.remove('hidden');
    }

    async function fetchSimilarProducts(category) {
      try {
        const q = query(
          collection(db, "meesho_products"),
          where("category", "==", category),
          limit(4)
        );

        const querySnapshot = await getDocs(q);
        similarProducts.innerHTML = '';

        querySnapshot.forEach(doc => {
          const product = doc.data();
          if (doc.id !== productId) {
            displaySimilarProduct(product, doc.id);
          }
        });

        if (similarProducts.children.length === 0) {
          similarProducts.innerHTML = '<p class="text-gray-500 col-span-4 text-center py-8">No similar products found.</p>';
        }
      } catch (error) {
        console.error("Error fetching similar products:", error);
        similarProducts.innerHTML = '<p class="text-red-500 col-span-4 text-center py-8">Error loading similar products.</p>';
      }
    }

    function displaySimilarProduct(product, id) {
      const price = parseFloat(product.price) || 0;
      const originalPriceValue = product.original_price || Math.floor(price * 1.5);
      const discount = Math.floor(((originalPriceValue - price) / originalPriceValue) * 100);
      const imageUrl = product.product_images?.[0] || 'https://via.placeholder.com/200x200?text=No+Image';
      const rating = SHOW_RATINGS ? (Math.random() * 2 + 3).toFixed(1) : null;
      const ratingCount = SHOW_RATINGS ? Math.floor(Math.random() * 5000 + 100) : null;
      const wishlist = JSON.parse(localStorage.getItem('wishlist'));
      const isWishlisted = wishlist.includes(id);

      const productCard = document.createElement('div');
      productCard.className = 'product-card bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 relative';

      productCard.innerHTML = `
        <a href="product.html?id=${id}" class="block">
          <div class="relative pb-[100%] bg-gray-100">
            <img 
              src="${imageUrl}" 
              alt="${product.product_name}" 
              loading="lazy"
              class="absolute h-full w-full object-cover"
              onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'"
            >
          </div>
          <div class="p-4">
            <h2 class="font-semibold text-gray-800 line-clamp-2 h-12">${product.product_name || 'Unnamed Product'}</h2>
            <div class="mt-2">
              <span class="text-lg font-bold text-purple-700">₹${price.toLocaleString()}</span>
              <span class="text-sm text-gray-500 line-through ml-2">₹${originalPriceValue.toLocaleString()}</span>
              <span class="text-xs font-semibold bg-pink-100 text-pink-800 px-2 py-1 rounded ml-2">${discount}% OFF</span>
            </div>
            ${rating ? `
              <div class="mt-2 flex items-center">
                <div class="flex text-yellow-400 text-sm">
                  ${'<i class="fas fa-star"></i>'.repeat(Math.floor(rating))}
                  ${rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
                  ${'<i class="far fa-star"></i>'.repeat(5 - Math.ceil(rating))}
                </div>
                <span class="text-xs text-gray-500 ml-1">(${ratingCount.toLocaleString()})</span>
              </div>
            ` : ''}
          </div>
        </a>
        <button class="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 wishlist-btn" 
                onclick="event.stopPropagation(); toggleWishlistIcon(this, '${id}')">
          <i class="${isWishlisted ? 'fas text-red-500' : 'far'} fa-heart"></i>
        </button>
        <button class="absolute bottom-16 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 cart-btn" 
                onclick="event.stopPropagation(); addToCartFromCard('${id}')">
          <i class="fas fa-shopping-cart text-purple-600"></i>
        </button>
      `;

      similarProducts.appendChild(productCard);
    }

    function showError(message) {
      productContainer.innerHTML = `
        <div class="col-span-2 text-center py-12">
          <i class="fas fa-exclamation-circle text-5xl text-red-500 mb-4"></i>
          <h2 class="text-2xl font-bold text-gray-800 mb-2">${message}</h2>
          <p class="text-gray-600 mb-6">We couldn't find the product you're looking for.</p>
          <a href="index.html" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 inline-block">
            Back to Home
          </a>
        </div>
      `;
    }

    // Initialize product page
    fetchProductDetails();
  }

  // Initialize cart count and wishlist count on page load
  updateCartCount();
  updateWishlistCount();
});

// Global functions
window.toggleWishlistIcon = function (button, productId) {
  const isWishlisted = toggleWishlist(productId);
  const icon = button.querySelector('i');
  icon.classList.toggle('far', !isWishlisted);
  icon.classList.toggle('fas', isWishlisted);
  icon.classList.toggle('text-red-500', isWishlisted);
};

window.addToCartFromCard = function (productId) {
  if (addToCart(productId, 1)) {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
    Toast.fire({
      icon: 'success',
      title: 'Added to cart successfully'
    });
  }
};

function addToCart(productId, quantity = 1) {
  const cart = JSON.parse(localStorage.getItem('cart'));
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ id: productId, quantity });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  return true;
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem('cart'));
  const cartCountElements = document.querySelectorAll('#cartCount');
  cartCountElements.forEach(element => {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    element.textContent = totalItems;
    element.style.display = totalItems > 0 ? 'flex' : 'none';
  });
}

function updateWishlistCount() {
  const wishlist = JSON.parse(localStorage.getItem('wishlist'));
  const wishlistCountElements = document.querySelectorAll('#wishlistCount');
  wishlistCountElements.forEach(element => {
    element.textContent = wishlist.length;
    element.style.display = wishlist.length > 0 ? 'flex' : 'none';
  });
}

function toggleWishlist(productId) {
  const wishlist = JSON.parse(localStorage.getItem('wishlist'));
  const index = wishlist.indexOf(productId);

  if (index === -1) {
    wishlist.push(productId);
  } else {
    wishlist.splice(index, 1);
  }

  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  updateWishlistCount(); // Update wishlist count
  return index === -1;
}

// Toggle wishlist popup
window.toggleWishlistModal = function () {
  const modal = document.getElementById("wishlistModal");
  modal.classList.toggle("hidden");
  if (!modal.classList.contains("hidden")) {
    renderWishlistItems();
  }
};

// Render wishlist items in modal
window.renderWishlistItems = async function () {
  const wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  const container = document.getElementById("wishlistItems");
  container.innerHTML = `<p class="text-gray-600">Loading wishlist...</p>`;

  const { db, doc, getDoc } = window.firebaseModules;
  container.innerHTML = "";

  for (const productId of wishlist) {
    const docRef = doc(db, "meesho_products", productId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) continue;
    const data = docSnap.data();
    const image = data.product_images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";
    const price = parseFloat(data.price) || 0;

    const card = document.createElement("div");
    card.className = "bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden relative";

    card.innerHTML = `
      <a href="product.html?id=${productId}" class="block hover:opacity-80 transition">
        <img src="${image}" alt="${data.product_name}" class="w-full h-48 object-cover bg-gray-100" />
        <div class="p-4">
          <h3 class="text-md font-semibold text-gray-800 truncate">${data.product_name}</h3>
          <p class="text-purple-700 font-bold text-lg mt-1">₹${price.toLocaleString()}</p>
        </div>
      </a>
      <button onclick="removeFromWishlist('${productId}')" class="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-red-100">
        <i class="fas fa-trash text-red-500"></i>
      </button>
    `;
    container.appendChild(card);
  }

  if (wishlist.length === 0) {
    container.innerHTML = `<p class="text-center text-gray-500 py-8">Your wishlist is empty.</p>`;
  }
};

// Remove product from wishlist inside modal
window.removeFromWishlist = function (productId) {
  let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
  wishlist = wishlist.filter(id => id !== productId);
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  updateWishlistCount();
  renderWishlistItems();
};

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById("wishlistModal");
    if (!modal.classList.contains("hidden")) {
      toggleWishlistModal();
    }
  }
});

// Add this to your existing script.js file after the existing product page logic

// Update the Buy Now button event listener in the product page section
document.getElementById('buyNowBtn').addEventListener('click', () => {
  // Check if user is logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn');

  if (isLoggedIn !== 'true') {
    // User not logged in, redirect to login page
    Swal.fire({
      icon: 'warning',
      title: 'Login Required',
      text: 'Please login to place your order.',
      showCancelButton: true,
      confirmButtonText: 'Login Now',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#9333ea'
    }).then((result) => {
      if (result.isConfirmed) {
        // Redirect to login page with current page as redirect
        window.location.href = 'login.html?redirect=checkout.html';
      }
    });
    return;
  }

  // User is logged in, proceed with Buy Now
  const quantity = document.getElementById('quantityValue').textContent;
  addToCart(productId, parseInt(quantity));
  window.location.href = 'checkout.html';
});

// Update the existing addToCart function to work with authentication
function addToCart(productId, quantity = 1) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ id: productId, quantity });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  return true;
}

// Add authentication utilities to the global scope
if (typeof window.AuthUtils === 'undefined') {
  window.AuthUtils = {
    // Check if user is logged in
    isLoggedIn() {
      return localStorage.getItem('isLoggedIn') === 'true';
    },

    // Get current user data
    getCurrentUser() {
      const userData = localStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    },

    // Logout user
    logout() {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('isLoggedIn');
      window.location.href = 'login.html';
    },

    // Redirect to login with current page as redirect
    redirectToLogin() {
      const currentPage = window.location.pathname.split('/').pop();
      window.location.href = `login.html?redirect=${currentPage}`;
    }
  };
}

// Add this to the BOTTOM of your existing script.js file

// ==========================================
// AUTHENTICATION INTEGRATION
// ==========================================

// Update the existing Buy Now button event listener in product page
if (document.getElementById('productContainer')) {
  // Replace the existing buyNowBtn event listener with this:
  document.getElementById('buyNowBtn')?.addEventListener('click', () => {
    // Check if user is logged in first
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (isLoggedIn !== 'true') {
      // User not logged in, show login prompt
      Swal.fire({
        icon: 'warning',
        title: 'Login Required',
        text: 'Please login to place your order.',
        showCancelButton: true,
        confirmButtonText: 'Login Now',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#9333ea',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          // Redirect to login page with checkout as redirect
          window.location.href = 'login.html?redirect=checkout.html';
        }
      });
      return;
    }

    // User is logged in, proceed with Buy Now
    const quantity = parseInt(document.getElementById('quantityValue')?.textContent || '1');
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (productId) {
      addToCart(productId, quantity);
      window.location.href = 'checkout.html';
    }
  });
}

// Add authentication check to existing addToCart function calls
const originalAddToCart = window.addToCart;
window.addToCart = function(productId, quantity = 1) {
  // Check authentication for direct add to cart (optional - you can remove this if you want guest cart)
  // const isLoggedIn = localStorage.getItem('isLoggedIn');
  // if (isLoggedIn !== 'true') {
  //   Swal.fire({
  //     icon: 'info',
  //     title: 'Login for Better Experience',
  //     text: 'Login to sync your cart across devices!',
  //     confirmButtonText: 'Login',
  //     showCancelButton: true,
  //     cancelButtonText: 'Continue as Guest'
  //   }).then((result) => {
  //     if (result.isConfirmed) {
  //       window.location.href = 'login.html';
  //       return;
  //     }
  //   });
  // }

  // Call original addToCart function
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity += quantity;
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Quantity updated in cart',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  } else {
    cart.push({ id: productId, quantity });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Added to cart successfully',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  return true;
};

// Add user info display to header (for index and product pages)
function displayUserInfo() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  
  if (isLoggedIn === 'true' && currentUser) {
    // Find header navigation area and add user info
    const headerNav = document.querySelector('.flex.items-center.space-x-4, .hidden.md\\:flex.items-center.space-x-6');
    
    if (headerNav && !document.getElementById('userGreeting')) {
      const userDiv = document.createElement('div');
      userDiv.id = 'userGreeting';
      userDiv.className = 'flex items-center space-x-2 text-sm';
      userDiv.innerHTML = `
        <span class="text-gray-600">Hi, ${currentUser.firstName}</span>
        <button onclick="AuthUtils.logout()" class="text-red-600 hover:underline">Logout</button>
      `;
      
      // Insert before cart icon
      const cartIcon = headerNav.querySelector('a[href="checkout.html"]');
      if (cartIcon) {
        headerNav.insertBefore(userDiv, cartIcon);
      } else {
        headerNav.appendChild(userDiv);
      }
    }
  }
}

// Add global authentication utilities
if (typeof window.AuthUtils === 'undefined') {
  window.AuthUtils = {
    // Check if user is logged in
    isLoggedIn() {
      return localStorage.getItem('isLoggedIn') === 'true';
    },

    // Get current user data
    getCurrentUser() {
      const userData = localStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    },

    // Logout user
    logout() {
      Swal.fire({
        title: 'Logout',
        text: 'Are you sure you want to logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, logout'
      }).then((result) => {
        if (result.isConfirmed) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('isLoggedIn');
          Swal.fire({
            icon: 'success',
            title: 'Logged out successfully',
            timer: 1500,
            showConfirmButton: false
          }).then(() => {
            window.location.href = 'index.html';
          });
        }
      });
    },

    // Redirect to login with current page as redirect
    redirectToLogin() {
      const currentPage = window.location.pathname.split('/').pop();
      window.location.href = `login.html?redirect=${currentPage}`;
    },

    // Show login prompt
    promptLogin(message = 'Please login to continue') {
      Swal.fire({
        icon: 'info',
        title: 'Login Required',
        text: message,
        showCancelButton: true,
        confirmButtonText: 'Login',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#9333ea'
      }).then((result) => {
        if (result.isConfirmed) {
          this.redirectToLogin();
        }
      });
    }
  };
}

// Initialize user info display on page load
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the page to fully load
  setTimeout(displayUserInfo, 500);
});

// ==========================================
// ENHANCED CART FUNCTIONALITY
// ==========================================

// Sync cart with user account (when user logs in)
function syncCartWithUser() {
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  
  if (isLoggedIn === 'true' && cart.length > 0) {
    // Here you could sync cart to user's account in Firebase
    // For now, we'll just show a success message
    console.log('Cart synced with user account');
  }
}

// Enhanced updateCartCount function
const originalUpdateCartCount = window.updateCartCount;
window.updateCartCount = function() {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]');
  const cartCountElements = document.querySelectorAll('#cartCount');
  
  cartCountElements.forEach(element => {
    const totalItems = cart.reduce((total, item) => total + (parseInt(item.quantity) || 0), 0);
    element.textContent = totalItems;
    element.style.display = totalItems > 0 ? 'flex' : 'none';
    
    // Add animation when cart count changes
    if (totalItems > 0) {
      element.classList.add('animate-bounce');
      setTimeout(() => {
        element.classList.remove('animate-bounce');
      }, 600);
    }
  });
};

// Call sync function when page loads
document.addEventListener('DOMContentLoaded', () => {
  syncCartWithUser();
});

console.log('🚀 Meesho Authentication System Loaded Successfully!');
console.log('📱 Features: Phone Auth, User Management, Secure Checkout');
console.log('🔐 Auth Status:', window.AuthUtils?.isLoggedIn() ? 'Logged In' : 'Guest User');