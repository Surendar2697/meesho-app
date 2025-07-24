// auth.js - Authentication System for Meesho

document.addEventListener("DOMContentLoaded", async () => {
  // Wait for Firebase to initialize
  while (!window.firebaseModules) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const {
    db,
    auth,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    signInWithCredential
  } = window.firebaseModules;

  // Global variables
  let currentPhone = "";
  let confirmationResult = null;
  let recaptchaVerifier = null;
  let resendTimer = null;
  let currentUser = null;

  // DOM elements
  const phoneStep = document.getElementById('phoneStep');
  const otpStep = document.getElementById('otpStep');
  const registerStep = document.getElementById('registerStep');
  const loadingState = document.getElementById('loadingState');

  const phoneForm = document.getElementById('phoneForm');
  const otpForm = document.getElementById('otpForm');
  const registerForm = document.getElementById('registerForm');

  const phoneNumber = document.getElementById('phoneNumber');
  const otpCode = document.getElementById('otpCode');
  const displayPhone = document.getElementById('displayPhone');

  // Initialize reCAPTCHA
  function initializeRecaptcha() {
    try {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }
      
      recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          console.log('reCAPTCHA solved');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          Swal.fire({
            icon: 'error',
            title: 'Verification Expired',
            text: 'Please try again.'
          });
        }
      });
    } catch (error) {
      console.error('Error initializing reCAPTCHA:', error);
    }
  }

  // Validate phone number
  function isValidPhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  // Check if user exists in database
  async function checkUserExists(phone) {
    try {
      const userDoc = await getDoc(doc(db, "customers", phone));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error checking user:', error);
      return null;
    }
  }

  // Generate unique user ID
  function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Save user to localStorage
  function saveUserToLocal(userData) {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
  }

  // Show loading state
  function showLoading() {
    phoneStep.classList.add('hidden');
    otpStep.classList.add('hidden');
    registerStep.classList.add('hidden');
    loadingState.classList.remove('hidden');
  }

  // Hide loading state
  function hideLoading() {
    loadingState.classList.add('hidden');
  }

  // Show step
  function showStep(step) {
    hideLoading();
    phoneStep.classList.add('hidden');
    otpStep.classList.add('hidden');
    registerStep.classList.add('hidden');
    step.classList.remove('hidden');
  }

  // Start resend timer
  function startResendTimer() {
    let timeLeft = 30;
    const resendBtn = document.getElementById('resendOtp');
    const timerDiv = document.getElementById('resendTimer');
    const timerCount = document.getElementById('timerCount');

    resendBtn.classList.add('hidden');
    timerDiv.classList.remove('hidden');

    resendTimer = setInterval(() => {
      timeLeft--;
      timerCount.textContent = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(resendTimer);
        resendBtn.classList.remove('hidden');
        timerDiv.classList.add('hidden');
      }
    }, 1000);
  }

  // Send OTP
  async function sendOTP(phone) {
    try {
      showLoading();
      
      if (!recaptchaVerifier) {
        initializeRecaptcha();
      }

      const fullPhoneNumber = `+91${phone}`;
      console.log('Sending OTP to:', fullPhoneNumber);

      confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
      
      currentPhone = phone;
      displayPhone.textContent = `+91 ${phone.replace(/(\d{5})(\d{5})/, '$1 $2')}`;
      
      showStep(otpStep);
      startResendTimer();

      Swal.fire({
        icon: 'success',
        title: 'OTP Sent!',
        text: 'Please check your phone for the verification code.',
        timer: 3000,
        showConfirmButton: false
      });

    } catch (error) {
      hideLoading();
      console.error('Error sending OTP:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMessage
      });
    }
  }

  // Verify OTP
  async function verifyOTP(otp) {
    try {
      showLoading();

      if (!confirmationResult) {
        throw new Error('No confirmation result available');
      }

      const result = await confirmationResult.confirm(otp);
      console.log('OTP verified successfully:', result);

      // Check if user exists
      const existingUser = await checkUserExists(currentPhone);
      
      if (existingUser) {
        // Update last login
        await updateDoc(doc(db, "customers", currentPhone), {
          lastLoginAt: serverTimestamp()
        });

        // Save to localStorage and redirect
        saveUserToLocal(existingUser);
        
        Swal.fire({
          icon: 'success',
          title: 'Welcome back!',
          text: `Hello ${existingUser.firstName}!`,
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          redirectAfterLogin();
        });
        
      } else {
        // New user - show registration form
        showStep(registerStep);
        
        Swal.fire({
          icon: 'info',
          title: 'New User',
          text: 'Please complete your profile to continue.',
          timer: 3000,
          showConfirmButton: false
        });
      }

    } catch (error) {
      hideLoading();
      console.error('Error verifying OTP:', error);
      
      let errorMessage = 'Invalid OTP. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid verification code.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP has expired. Please request a new one.';
      }

      Swal.fire({
        icon: 'error',
        title: 'Verification Failed',
        text: errorMessage
      });

      // Clear OTP input
      otpCode.value = '';
    }
  }

  // Create new user account
  async function createUserAccount(formData) {
    try {
      showLoading();

      const userId = generateUserId();
      const userData = {
        id: userId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: currentPhone,
        email: formData.email || '',
        addresses: [{
          id: 'default_' + Date.now(),
          type: 'home',
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          isDefault: true
        }],
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };

      // Save to Firestore
      await setDoc(doc(db, "customers", currentPhone), userData);

      // Save to localStorage
      saveUserToLocal(userData);

      Swal.fire({
        icon: 'success',
        title: 'Account Created!',
        text: `Welcome to Meesho, ${formData.firstName}!`,
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        redirectAfterLogin();
      });

    } catch (error) {
      hideLoading();
      console.error('Error creating account:', error);
      
      Swal.fire({
        icon: 'error',
        title: 'Account Creation Failed',
        text: 'Failed to create account. Please try again.'
      });
    }
  }

  // Redirect after successful login
  function redirectAfterLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect') || 'checkout.html';
    window.location.href = redirect;
  }

  // Event Listeners

  // Phone form submission
  phoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const phone = phoneNumber.value.trim();
    
    if (!isValidPhone(phone)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Phone Number',
        text: 'Please enter a valid 10-digit mobile number.'
      });
      return;
    }

    await sendOTP(phone);
  });

  // OTP form submission
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const otp = otpCode.value.trim();
    
    if (otp.length !== 6) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid OTP',
        text: 'Please enter a valid 6-digit OTP.'
      });
      return;
    }

    await verifyOTP(otp);
  });

  // Registration form submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      addressLine1: document.getElementById('addressLine1').value.trim(),
      addressLine2: document.getElementById('addressLine2').value.trim(),
      city: document.getElementById('city').value.trim(),
      district: document.getElementById('district').value.trim(),
      state: document.getElementById('state').value,
      pincode: document.getElementById('pincode').value.trim()
    };

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.addressLine1 || 
        !formData.city || !formData.district || !formData.state || !formData.pincode) {
      Swal.fire({
        icon: 'error',
        title: 'Missing Information',
        text: 'Please fill in all required fields.'
      });
      return;
    }

    // Validate PIN code
    if (!/^\d{6}$/.test(formData.pincode)) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid PIN Code',
        text: 'Please enter a valid 6-digit PIN code.'
      });
      return;
    }

    await createUserAccount(formData);
  });

  // Change number button
  document.getElementById('changeNumber').addEventListener('click', () => {
    currentPhone = "";
    confirmationResult = null;
    if (resendTimer) {
      clearInterval(resendTimer);
    }
    showStep(phoneStep);
    phoneNumber.value = "";
  });

  // Resend OTP button
  document.getElementById('resendOtp').addEventListener('click', async () => {
    if (currentPhone) {
      await sendOTP(currentPhone);
    }
  });

  // Phone number input formatting
  phoneNumber.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    e.target.value = value;
  });

  // OTP input formatting
  otpCode.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    e.target.value = value;
  });

  // PIN code input formatting
  document.getElementById('pincode').addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    e.target.value = value;
  });

  // Auto-focus next input on OTP entry
  otpCode.addEventListener('input', (e) => {
    if (e.target.value.length === 6) {
      document.getElementById('verifyOtpBtn').focus();
    }
  });

  // Initialize reCAPTCHA on page load
  initializeRecaptcha();

  // Check if user is already logged in
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    // User is already logged in, redirect to intended page
    redirectAfterLogin();
  }
});

// Utility functions for other pages
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