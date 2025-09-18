// Import Firebase modules
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCustomToken,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getStorage, 
  ref as storageRef, // Use 'as' to avoid conflict with RTDB 'ref'
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  onDisconnect,
  serverTimestamp, // RTDB serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";   
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
  orderBy,
  limit,
  startAfter,
  documentId,
  serverTimestamp as firestoreServerTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";           
               
//MAIN APP//

// --- Main Application Logic ---
const DAILY_REWARD_POINTS = [10, 15, 20, 25, 100]; // Day 1, Day 2, Day 3, Day 4, Day 5
const App = function () {


this.manageWakeLock = () => {
  // Check if the Screen Wake Lock API is supported by the browser
  if ('wakeLock' in navigator) {
    
    const requestWakeLock = async () => {
      try {
        // Request a screen wake lock
        this.state.wakeLockSentinel = await navigator.wakeLock.request('screen');
        
        // Listen for when the lock is released (e.g., user switches tabs)
        this.state.wakeLockSentinel.addEventListener('release', () => {
          console.log('Screen Wake Lock was released.');
          this.state.wakeLockSentinel = null; // Clear the sentinel
        });
        
        console.log('Screen Wake Lock is active.');
      } catch (err) {
        // This can happen if the user denies the request or for other reasons
        console.error(`Could not acquire Wake Lock: ${err.name}, ${err.message}`);
      }
    };

    // Request the lock for the first time
    requestWakeLock();
    
    // When the user comes back to the app, we need to re-acquire the lock.
    // The browser automatically releases it when the tab is not visible.
    document.addEventListener('visibilitychange', () => {
      if (this.state.wakeLockSentinel === null && document.visibilityState === 'visible') {
        console.log('Re-acquiring Screen Wake Lock after visibility change.');
        requestWakeLock();
      }
    });

  } else {
    console.log('Screen Wake Lock API not supported on this browser.');
  }
};

 
// This function is called when the user clicks the "Edit" (pencil) icon
this.handleEditClick = (id) => {
  // Find the full announcement object from the state using its ID
  const announcementToEdit = this.state.announcements.find(ann => ann.id === id);

  // If we didn't find the announcement, stop to prevent errors
  if (!announcementToEdit) {
    console.error("Could not find announcement to edit with ID:", id);
    return;
  }

  const form = document.getElementById('announcement-form');
  const submitBtn = document.getElementById('announcement-submit-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const formTitle = document.getElementById('announcement-form-title');
  
  // Populate the form using the data we found
  form.elements.announcementId.value = announcementToEdit.id;
  form.elements.announcementTitle.value = announcementToEdit.title;
  form.elements.announcementMessage.value = announcementToEdit.message;
  
  // Change the UI to "Edit Mode"
  formTitle.textContent = "Edit Announcement";
  submitBtn.textContent = "Update Announcement";
  cancelBtn.classList.remove('hidden'); // Show the cancel button
  
  // Scroll to the top of the page to show the form
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// This function is called when the user clicks the "Cancel" button
this.handleCancelEdit = () => {
  const form = document.getElementById('announcement-form');
  const submitBtn = document.getElementById('announcement-submit-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const formTitle = document.getElementById('announcement-form-title');

  // Clear all form fields
  form.reset();
  form.elements.announcementId.value = '';

  // Change the UI back to "Create Mode"
  formTitle.textContent = "Post New Announcement";
  submitBtn.textContent = "Post Announcement";
  cancelBtn.classList.add('hidden'); // Hide the cancel button
};
// in script.js, replace the existing scrollCarousel function

this.scrollCarousel = (direction) => {
  const carousel = document.getElementById('dashboard-carousel');
  if (carousel) {
      const scrollAmount = carousel.clientWidth * direction;

      // Check if the carousel is at the very end
      // We add a small buffer (1px) to account for potential decimal values
      const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;

      // Check if the carousel is at the very beginning
      const isAtStart = carousel.scrollLeft === 0;

      if (direction === 1 && isAtEnd) {
          // If scrolling right at the end, loop to the beginning
          carousel.scrollTo({
              left: 0,
              behavior: 'smooth'
          });
      } else if (direction === -1 && isAtStart) {
          // If scrolling left at the beginning, loop to the end
          carousel.scrollTo({
              left: carousel.scrollWidth,
              behavior: 'smooth'
          });
      } else {
          // Otherwise, just scroll normally
          carousel.scrollBy({
              left: scrollAmount,
              behavior: 'smooth'
          });
      }
  }
};

  this.aboutAudio = null; 
  // --- STATE MANAGEMENT ---
  const currentDate = new Date();
  this.state = {
    chats: [], // Stores the list of chat conversations for the current user
    currentChatId: null, // Stores the ID of the chat currently being viewed
    currentChatMessages: [], // Stores messages for the currentChatId
    chatListeners: [], // To store unsubscribe functions for chat-related snapshots
    adminRewardsView: "form", // Can be 'form' or 'list'
    calendarDate: currentDate,
    currentPage: "auth",
    loggedInUser: null, // This will hold the user profile from Firestore
    firebaseUser: null, // This will hold the auth user object
    users: [], // All users for admin view
    events: [],
    rewards: [],
    announcements: [],
    badges: [],
    earnedBadges: [],
    rsvps: [],
    pointLogs: [], // Logs for the current user
    systemLogs: [], // For admin view
    mapSpots: [],
    logFilter: {
      year: currentDate.getFullYear().toString(),
      month: (currentDate.getMonth() + 1).toString(),
      day: currentDate.getDate().toString(), // Set the default day to the current day
    },
    directorySearch: "",
    directoryDisplayCount: 10,
    adminEmail: "titoycustodio@bipsu.edu.ph",
    adminActiveTab: "verification",
    adminMemberSearch: "",
    adminRewardSearch: "",
    adminEditingRewardId: null, // To track the reward being edited
    adminRewards: [],
    allRewardsLoadedForAdmin: false, //  <-- ADD THIS LINE
    leaderboardDisplayCount: 10, // For client-side infinite scroll
    leaderboardLoading: false, // PREVENTS THE LOADING LOOP
    directorySearch: "",
    listeners: [], // To store unsubscribe functions for snapshots
    html5QrCode: null, // To hold the scanner instance
    calendarDate: new Date(),
    firstVisibleMessage: null,
    allMessagesLoaded: false,
    dailyRewardTimerId: null,
    carouselItems: [],
    wakeLockSentinel: null,
  };



this.handleShowMoreDirectory = () => {
  // Increase the number of users to display by 20
  this.state.directoryDisplayCount += 20;
  // Re-render the page to show the new users
  this.render();
};

//PROFILE CARD
this.renderDashboardProfile = (user) => {
  const earnedBadges = (user.earnedBadgeIds || []).map((badgeId) => this.state.badges.find((b) => b.id === badgeId)).filter(Boolean).slice(0, 10);
  return `
    <div class="relative">
        
        
        <div class="absolute -inset-1.5 pride-gradient-bg rounded-2xl blur-lg opacity-75"></div>
            <div class="relative pride-gradient-bg p-1 rounded-2xl shadow-lg">
            <div class="bg-gray-800 rounded-xl p-4 space-y-4">
                
                <!-- START: ADD THIS NEW TITLE SECTION -->
                <div class="text-center pb-3 border-b border-gray-700">
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Member Card
                    </h3>
                </div>
                <!-- END: ADD THIS NEW TITLE SECTION -->

                <div class="flex space-x-4 items-center">
                    <img src="${user.profilePic}" class="w-20 h-20 rounded-full object-cover border-4 border-gray-700">
                    <div class="flex-1">
                        <h2 class="text-l font-bold">${user.firstName} ${user.lastName}</h2>
                        <div class="flex items-center text-2xl font-bold pride-gradient-text mb-1">
                            <i data-lucide="circle-star" class="w-7 h-7 mr-2 pride-gradient-text"></i>
                            <span>${user.points || 0}</span><span class="text-sm pride-gradient-text ml-1"> PTS</span>
                            
                         
                            </div>
                            <p class="text-[12px] pride-gradient-text">Points in Peso: ₱${((user.points || 0) / 50).toFixed(2)}</p>
                        <p class="text-[10px] text-gray-400">${user.email || "N/A"}</p>
                        
                    </div>
                    <div class="bg-white p-1 rounded-lg cursor-pointer" onclick="app.openMemberQrModal()">
                        <canvas id="member-qr-code"></canvas>
                    </div>
                </div>
                ${
                  earnedBadges.length > 0
                    ? `
                <div class="border-t border-gray-700 pt-3">
                    <div class="flex items-center justify-center space-x-3">
                        ${earnedBadges
                          .map((badge) =>
                            this.renderBadgeIcon(badge.icon, "w-6 h-6 text-amber-400")
                          )
                          .join("")}
                    </div>
                </div>`
                    : ""
                }
            </div>
        </div>
    </div>`;
};


// DASHBOARD CAROUSEL IMAGE
this.renderDashboardCarousel = () => {
  const carouselItems = [
    { imageUrl: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzIwNW9pdzMyOTFna2ZjZ2V6dWZqMnJtNWg0N2x6NXJqdTQ4ZHN3MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TvG2o6Bob9saazDlu8/giphy.gif", link: "rewards" },
    { imageUrl: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/236ecf96-a881-428d-9213-83d1c7313131/dkjb4v0-af1ec6b9-6075-4a3c-b662-ed5512cb6fbf.png/v1/fit/w_800,h_450,q_70,strp/director_by_titoycute_dkjb4v0-414w-2x.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9NDUwIiwicGF0aCI6Ii9mLzIzNmVjZjk2LWE4ODEtNDI4ZC05MjEzLTgzZDFjNzMxMzEzMS9ka2piNHYwLWFmMWVjNmI5LTYwNzUtNGEzYy1iNjYyLWVkNTUxMmNiNmZiZi5wbmciLCJ3aWR0aCI6Ijw9ODAwIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmltYWdlLm9wZXJhdGlvbnMiXX0.kIGGldx0F4f2G3KM_9AgMEk0QdiFctJP3vJbB8MhjOU", link: "directory" },
    { imageUrl: "https://i.pinimg.com/1200x/fe/4d/a1/fe4da1dd4b4a61e5717ef1c73a169c99.jpg", link: "leaderboard" }
  ];

  return `
    <div class="relative w-full">
        <div class="carousel-container" id="dashboard-carousel">
            ${carouselItems.map(item => `
                <div class="carousel-item" 
                     style="background-image: url('${item.imageUrl}')" 
                     onclick="app.navigateTo('${item.link}')">
                </div>
            `).join('')}
        </div>
        <button onclick="app.scrollCarousel(-1)" class="carousel-arrow left-0"><i data-lucide="chevron-left"></i></button>
        <button onclick="app.scrollCarousel(1)" class="carousel-arrow right-0"><i data-lucide="chevron-right"></i></button>
    </div>
  `;
};



//DAILY REWARDS
this.renderDashboardDailyRewards = () => {
  this.prepareLoginRewardState(this.state.loggedInUser);
  const rewardState = this.state.loginReward || { currentStreak: 0, canClaim: false };

  const rewardBoxes = [1, 2, 3, 4, 5].map((day) => {
    const isClaimed = day <= rewardState.currentStreak;
    const isClaimable = rewardState.canClaim && day === rewardState.currentStreak + 1;
    const points = DAILY_REWARD_POINTS[day - 1];
    
    let boxClass = "bg-gray-700/50 border-2 border-gray-600";
    // MINIMIZED: Text is smaller for a more compact look
    let content = `<div class="font-bold text-gray-400 text-sm">${day}</div><div class="text-[10px] text-gray-500">${points} pts</div>`;
    let onClick = "";
    let finalHtml;

    if (isClaimed) {
      boxClass = "bg-yellow-500/30 border-2 border-yellow-500";
      // MINIMIZED: Icon is smaller
      content = `<i data-lucide="check-circle" class="w-6 h-6 text-yellow-400 mx-auto"></i>`;
      
      // BLUR SHADOW EFFECT: We wrap the claimed box in a relative container
      // with an absolute, blurred element behind it.
      finalHtml = `
        <div class="relative">
          <div class="absolute -inset-1 bg-yellow-500 rounded-xl blur-lg opacity-60"></div>
          <div class="relative rounded-lg p-2 aspect-square flex flex-col justify-center items-center ${boxClass}">
            ${content}
          </div>
        </div>
      `;
    } else {
      if (isClaimable) {
        boxClass = "bg-green-500/30 border-2 border-green-500 cursor-pointer animate-pulse";
        // MINIMIZED: Text is smaller
        content = `<div class="font-bold text-white text-sm">Claim</div><div class="text-xs text-green-300">${points} pts</div>`;
        onClick = `onclick="app.claimDailyReward()"`;
      }
      // The non-claimed boxes don't get the glow wrapper
      finalHtml = `<div class="rounded-lg p-2 aspect-square flex flex-col justify-center items-center ${boxClass}" ${onClick}>${content}</div>`;
    }

    return finalHtml;
  }).join("");

  return `
    <div class="mb-4">
        <h3 class="text-s font-bold text-white mb-2">Daily Rewards</h3>
        <div class="grid grid-cols-5 gap-3 text-center">
            ${rewardBoxes}
        </div>
    </div>`;
};

//DASHBOARD BUTTONS
this.renderDashboardActions = () => {
    return `
    <div class="grid grid-cols-3 gap-3"> 
          <button onclick="app.navigateTo('scanner')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="scan-line" class="text-pink-400"></i>
              <span class="font-semibold text-xs">Scan QR Code</span>
          </button>
          <button onclick="app.navigateTo('profile')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="user-circle" class="text-purple-400"></i>
              <span class="font-semibold text-xs">My Profile</span>
          </button>
          <button onclick="app.navigateTo('facebookFeed')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="facebook" class="text-blue-400"></i>
              <span class="font-semibold text-xs">BBGS Updates</span>
          </button>
          <button onclick="app.navigateTo('qrSpots')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="map-pin" class="text-green-400"></i>
              <span class="font-semibold text-xs">QR Spots</span>
          </button>
          <button onclick="app.navigateTo('directory')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="users" class="text-orange-400"></i>
              <span class="font-semibold text-xs">Members Directory</span>
          </button>
          <button onclick="app.navigateTo('leaderboard')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="bar-chart-3" class="text-pink-400"></i>
              <span class="font-semibold text-xs">Ranks</span>
          </button>
          <button onclick="app.navigateTo('announcements')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
              <i data-lucide="megaphone" class="text-red-400"></i>
              <span class="font-semibold text-xs">Announcement</span>
          </button>
           <button onclick="app.navigateTo('userguide')" class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
            <i data-lucide="book-open" class="text-yellow-400"></i>
            <span class="font-semibold text-xs">User Guide</span>
        </button>

         <button onclick="app.navigateTo('badges')"class="bg-gray-700 p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-gray-600 transition-colors">
           <i data-lucide="circle-star" class="text-green-400"></i>
            <span class="text-xs mt-1">Badges</span>
          </button>
      </div>
    `;
};

/**
 * Renders the latest announcement for the dashboard.
 */
this.renderDashboardAnnouncement = () => {
    const latestAnnouncement = this.state.announcements[0];
    if (!latestAnnouncement) return "";

    return `
      <div class="bg-gray-900/50 p-4 rounded-xl border-l-4 border-pink-500">
          <div class="flex items-center justify-between mb-1">
              <h3 class="font-bold text-lg text-pink-400">Announcement</h3>
              <p class="text-xs text-gray-400">${latestAnnouncement.timestamp}</p>
          </div>
          <p class="text-gray-300">${latestAnnouncement.message}</p>
      </div>
    `;
};

  // Add these new functions inside your App function in script.js

  // Add these two new functions inside your App function in script.js

  this.prepareLoginRewardState = (userData) => {
    const today = new Date().toISOString().split("T")[0]; // Get date as "YYYY-MM-DD"
    const lastLogin =
      userData.lastLoginDate?.toDate().toISOString().split("T")[0] || null;

    let currentStreak = userData.consecutiveLogins || 0;
    let canClaim = false;

    if (lastLogin !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastLogin !== yesterdayStr) {
        // Streak is broken if last login wasn't yesterday
        currentStreak = 0;
      }

      if (currentStreak >= 5) {
        // Completed a 5-day cycle, so reset for a new one
        currentStreak = 0;
      }
      canClaim = true;
    }

    this.state.loginReward = {
      currentStreak,
      canClaim,
    };
  };

  // Replace your existing claimDailyReward function with this one

 this.claimDailyReward = async () => {
  if (!this.state.loginReward.canClaim) {
    this.showModal(
      "error",
      "Already Claimed",
      "You have already claimed your reward for today."
    );
    return;
  }

  this.showLoading("Claiming Reward...");
  const uid = this.fb.auth.currentUser.uid;
  const userRef = doc(this.fb.db, this.paths.users, uid);

  try {
    const newStreak = (this.state.loginReward.currentStreak % 5) + 1;
    const pointsToAdd = DAILY_REWARD_POINTS[newStreak - 1];

    // 1. Update the document in Firestore.
    await updateDoc(userRef, {
      points: increment(pointsToAdd),
      consecutiveLogins: newStreak,
      lastLoginDate: Timestamp.now(),
    });

    // 2. Fetch the updated user data directly from Firestore.
    const updatedUserDoc = await getDoc(userRef);
    this.state.loggedInUser = {
      id: updatedUserDoc.id,
      ...updatedUserDoc.data(),
    };

    // --- START: THIS IS THE NEW LINE YOU REQUESTED ---
    // 3. Log this action to the admin system log.
    const user = this.state.loggedInUser;
    await this.logAction("DAILY_REWARD_CLAIM", `${user.firstName} ${user.lastName} claimed ${pointsToAdd} points for their Day ${newStreak} streak.`);
    // --- END: NEW LINE ---

    // 4. Hide the loading spinner and show the success message.
    this.hideLoading();
    this.showModal(
      "success",
      "Reward Claimed!",
      `You have earned ${pointsToAdd} points! Your streak is now ${newStreak} days.`
    );

    // 5. Re-render the dashboard with the fresh, correct data.
    this.render("dashboard");
    lucide.createIcons();
  } catch (error) {
    console.error("Error claiming reward: ", error);
    this.hideLoading();
    this.showModal(
      "error",
      "Error",
      "Could not claim your reward. Please try again."
    );
  }
};

  // Add this new function to handle the timer logic
this.startDailyRewardTimer = () => {
  // Stop any existing timer to prevent multiple timers running at once
  if (this.state.dailyRewardTimerId) {
      clearInterval(this.state.dailyRewardTimerId);
  }

  const timerElement = document.getElementById("daily-reward-timer");
  if (!timerElement) {
      return; // Exit if the timer element isn't on the page
  }

  const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Midnight of the next day

      const timeRemaining = tomorrow - now;

      if (timeRemaining <= 0) {
          clearInterval(this.state.dailyRewardTimerId);
          this.state.dailyRewardTimerId = null;
          this.render("dashboard"); // Re-render the dashboard to show the "Claim" button
          return;
      }

      const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
      const seconds = Math.floor((timeRemaining / 1000) % 60);

      const formattedTime =
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      timerElement.textContent = `Next reward in: ${formattedTime}`;
  };

  // Run immediately and then every second
  updateTimer();
  this.state.dailyRewardTimerId = setInterval(updateTimer, 1000);
};

// Add this function to stop the timer
this.stopDailyRewardTimer = () => {
  if (this.state.dailyRewardTimerId) {
      clearInterval(this.state.dailyRewardTimerId);
      this.state.dailyRewardTimerId = null;
  }
};

  // Replace your old downloadAttendees function with this one
  this.downloadAttendees = async (eventId, eventName) => {
    this.showLoading("Fetching attendee data...");

    try {
      // 1. Get all check-ins for the specified event
      const checkInsRef = collection(this.fb.db, this.paths.checkIns);
      const q = query(checkInsRef, where("eventId", "==", eventId));
      const checkInsSnapshot = await getDocs(q);

      if (checkInsSnapshot.empty) {
        this.hideLoading();
        this.showModal(
          "info",
          "No Attendees",
          "There are no attendees for this event yet."
        );
        return;
      }

      // THIS IS THE CORRECTED PART
      const attendeePromises = checkInsSnapshot.docs.map((checkInDoc) => {
        // Variable renamed from 'doc' to 'checkInDoc'
        const userId = checkInDoc.data().userId;
        const userDocRef = doc(this.fb.db, this.paths.users, userId); // Now 'doc' correctly refers to the Firebase function
        return getDoc(userDocRef);
      });

      const userDocs = await Promise.all(attendeePromises);
      const attendees = userDocs.map((userDoc) => userDoc.data());

      // 3. Convert the data to CSV format
      let csvContent = "data:text/csv;charset=utf-8,";
      // Add headers
      csvContent += "Name,Email,Points\r\n";

      // Add rows
      attendees.forEach((attendee) => {
        if (attendee) {
          // Ensure attendee data exists
          const fullName = `${attendee.firstName} ${attendee.lastName}`;
          csvContent += `"${fullName}","${attendee.email}",${attendee.points}\r\n`;
        }
      });

      // 4. Create a link and trigger the download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);

      // Sanitize the event name for the filename
      const safeEventName = eventName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      link.setAttribute("download", `${safeEventName}_attendees.csv`);

      document.body.appendChild(link); // Required for Firefox
      link.click();
      document.body.removeChild(link);

      this.hideLoading();
    } catch (error) {
      console.error("Error downloading attendees:", error);
      this.hideLoading();
      this.showModal(
        "error",
        "Download Failed",
        "Could not download the attendee list. Please try again."
      );
    }
  };

  this.showLoading = (message) => {
    this.elements.modalTitle.textContent = message || "Loading...";
    this.elements.modalMessage.textContent = "Please wait a moment.";
    this.elements.modalIcon.innerHTML = `<svg class="animate-spin h-10 w-10 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>`;
    this.elements.modalButtons.innerHTML = ""; // No buttons for loading
    this.elements.modal.classList.remove("hidden");
    
  };

  this.hideLoading = () => {
    this.elements.modal.classList.add("hidden");
  };
  // --- Chat Functionality ---

  // In script.js, replace your first 'openChat' function with this

  this.openChat = (chatId) => {
    // --- START: ADDED SECTION ---
    // Reset unread count for the current user when they open the chat
    const currentUser = this.state.loggedInUser;
    if (currentUser && chatId) {
      const chatRef = doc(this.fb.db, this.paths.chatDoc(chatId));
      // We use dot notation to update a specific field in the map
      updateDoc(chatRef, {
        [`unreadCount.${currentUser.id}`]: 0,
      }).catch((error) =>
        console.error("Error resetting unread count:", error)
      );
    }
    // --- END: ADDED SECTION ---
  
    this.state.currentChatId = chatId;
    this.detachChatListeners(); // Remove old message listeners
    this.listenToChatMessages(chatId);
    this.navigateTo("messages");
  
    setTimeout(() => {
      const messagesContainer = document.getElementById("messages-container");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  };

  this.listenToUsers = () => {
    const usersCollectionRef = collection(this.fb.db, this.paths.users);
    const q = query(usersCollectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Update the local state with the latest user data
        this.state.users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Re-render the chat list and active chat views to show updated status
        if (this.state.currentPage === "messages") {
          this.render();
        }
      },
      (error) => {
        console.error("Error listening to users:", error);
      }
    );

    // Save the unsubscribe function to the general listeners array
    this.state.listeners.push(unsubscribe);
  };

  this.listenToChatMessages = (chatId) => {
    if (!chatId) return;

    this.detachChatListeners();

    // Reset state for the new chat
    this.state.allMessagesLoaded = false;
    this.state.firstVisibleMessage = null;
    this.state.currentChatMessages = [];

    const q = query(
      collection(this.fb.db, this.paths.messages(chatId)),
      orderBy("timestamp", "desc"),
      limit(15)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // **THIS IS THE FIX**: We only assume all messages are loaded
        // if the number of documents returned is LESS than our limit of 15.
        // If it returns exactly 15, there might be more.
        this.state.allMessagesLoaded = snapshot.docs.length < 15;

        if (!snapshot.empty) {
          // Save the oldest message from this batch as our cursor
          this.state.firstVisibleMessage =
            snapshot.docs[snapshot.docs.length - 1];
        }

        // Reverse the array to display chronologically
        this.state.currentChatMessages = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .reverse();

        // Render the UI and then scroll to the bottom
        this.render();
        this.postRender(); // Call postRender to handle scrolling
      },
      (error) => console.error("Error listening to messages:", error)
    );

    this.state.chatListeners.push(unsubscribe);
  };

  // This is the entire loadMoreMessages function for reference
  this.loadMoreMessages = async () => {
    if (!this.state.currentChatId || this.state.allMessagesLoaded) return;

    const container = document.getElementById("messages-container");
    const oldScrollHeight = container.scrollHeight;

    const q = query(
      collection(this.fb.db, this.paths.messages(this.state.currentChatId)),
      orderBy("timestamp", "desc"),
      startAfter(this.state.firstVisibleMessage),
      limit(10) // <--- CHANGE THIS LINE
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      this.state.firstVisibleMessage = snapshot.docs[snapshot.docs.length - 1];

      const olderMessages = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .reverse();
      this.state.currentChatMessages = [
        ...olderMessages,
        ...this.state.currentChatMessages,
      ];

      if (snapshot.docs.length < 10) {
        // <--- AND CHANGE THIS LINE
        this.state.allMessagesLoaded = true;
      }
    } else {
      this.state.allMessagesLoaded = true;
    }
    this.render();
    setTimeout(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - oldScrollHeight;
    }, 10);
  };

  this.detachChatListeners = () => {
    this.state.chatListeners.forEach((unsub) => unsub());
    this.state.chatListeners = [];
  };

  // Sends a message in the current chat
  this.sendMessage = async (e) => {
    e.preventDefault();
    const messageText = e.target.elements.messageText.value.trim();
    if (!messageText || !this.state.currentChatId || !this.state.loggedInUser) {
      return;
    }

    // 1. Create a temporary message for an instant UI update.
    const optimisticMessage = {
      id: `temp_${Date.now()}`,
      senderId: this.state.loggedInUser.id,
      text: messageText,
      timestamp: Timestamp.now(), // Use local time for immediate display
    };

    // 2. Add the message to the local state and clear the input field.
    this.state.currentChatMessages.push(optimisticMessage);
    e.target.reset();

    // 3. Re-render the UI to show the new message right away.
    this.render();

    // 4. Scroll to the bottom to view the newly sent message.
    setTimeout(() => {
      const messagesContainer = document.getElementById("messages-container");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      // 5. In the background, send the actual message to the database.
      const chatRef = doc(
        this.fb.db,
        this.paths.chatDoc(this.state.currentChatId)
      );
      const messagesCollectionRef = collection(chatRef, "messages");

      await addDoc(messagesCollectionRef, {
        senderId: this.state.loggedInUser.id,
        text: messageText,
        timestamp: Timestamp.now(),
      });

      // Update the parent chat document with the last message info.
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTimestamp: Timestamp.now(),
      });

      // The real-time listener will automatically refresh the chat
      // with the final message from the server, replacing the temporary one.
    } catch (error) {
      console.error("Error sending message:", error);
      this.showModal("error", "Message Error", "Failed to send message.");

      // If sending fails, remove the optimistic message from the UI.
      this.state.currentChatMessages = this.state.currentChatMessages.filter(
        (msg) => msg.id !== optimisticMessage.id
      );
      this.render(); // Re-render to show the message has been removed.
    }
  };
  //UNSEND MESSAGE//
  this.unsendMessage = (chatId, messageId) => {
    if (!chatId || !messageId) return;

    this.showModal(
      "confirm",
      "Unsend Message?",
      "This will permanently delete the message. This action cannot be undone.",
      async () => {
        try {
          const messageRef = doc(
            this.fb.db,
            this.paths.messages(chatId),
            messageId
          );
          await updateDoc(messageRef, {
            isRemoved: true,
            text: "This message was removed.",
          });

          // NOTE: The real-time listener will automatically update the UI.
          // For a more advanced implementation, you could update the `lastMessage`
          // on the parent chat document if this was the last message.
        } catch (error) {
          console.error("Error unsending message:", error);
          this.showModal("error", "Error", "Could not unsend the message.");
        }
      }
    );
  };

  // Initiates a chat with a specific user from the directory
  this.startChatWithUser = async (targetUserId) => {
    const currentUser = this.state.loggedInUser;
    if (!currentUser || !targetUserId || currentUser.id === targetUserId) {
      this.showModal("error", "Chat Error", "Cannot start chat.");
      return;
    }

    // Check if chat exists
    const q = query(
      collection(this.fb.db, this.paths.chats),
      where("participants", "array-contains", currentUser.id)
    );
    const snapshot = await getDocs(q);

    let existingChatId = null;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.participants.includes(targetUserId) &&
        data.participants.length === 2
      ) {
        existingChatId = doc.id;
      }
    });

    if (existingChatId) {
      this.openChat(existingChatId);
    } else {
      // Create new chat

      const newChatRef = await addDoc(
        collection(this.fb.db, this.paths.chats),
        {
          participants: [currentUser.id, targetUserId],
          createdAt: Timestamp.now(),
          type: "direct",
          lastMessage: "",
          lastMessageTimestamp: Timestamp.now(),
          // --- ADD THIS OBJECT ---
          unreadCount: {
            [currentUser.id]: 0,
            [targetUserId]: 0,
          },
        }
      );
      this.openChat(newChatRef.id);
    }
  };
  

  // Closes the active chat and returns to the chat list
  this.closeChat = () => {
    // Check if there's a chat open and a logged-in user
    const currentUser = this.state.loggedInUser;
    const currentChatId = this.state.currentChatId;

    if (currentUser && currentChatId) {
      const chatRef = doc(this.fb.db, this.paths.chatDoc(currentChatId));
      // Reset unread count for the current user when they close the chat
      updateDoc(chatRef, {
        [`unreadCount.${currentUser.id}`]: 0,
      }).catch((error) => console.error("Error resetting unread count:", error));
    }

    this.state.currentChatId = null;
    this.state.currentChatMessages = [];
    this.detachChatListeners(); // Detach messages listener
    this.listenToUserChats();
    this.navigateTo("messages"); // Navigate back to the messages view (which will show the list)
  };

  // Sends a message in the current chat
  // In script.js, replace your first 'sendMessage' function with this

  this.sendMessage = async (e) => {
    e.preventDefault();
    const messageText = e.target.elements.messageText.value.trim();
    if (!messageText || !this.state.currentChatId || !this.state.loggedInUser) {
      return;
    }

    const optimisticMessage = {
      id: `temp_${Date.now()}`,
      senderId: this.state.loggedInUser.id,
      text: messageText,
      timestamp: Timestamp.now(),
    };

    this.state.currentChatMessages.push(optimisticMessage);
    e.target.reset();
    this.render();

    setTimeout(() => {
      const messagesContainer = document.getElementById("messages-container");
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      const chatRef = doc(
        this.fb.db,
        this.paths.chatDoc(this.state.currentChatId)
      );
      const messagesCollectionRef = collection(chatRef, "messages");

      await addDoc(messagesCollectionRef, {
        senderId: this.state.loggedInUser.id,
        text: messageText,
        timestamp: Timestamp.now(),
      });

      // --- START: MODIFIED SECTION ---
      // Find the current chat to get participant info
      const currentChat = this.state.chats.find(
        (c) => c.id === this.state.currentChatId
      );
      if (!currentChat) {
        console.error("Could not find chat to update unread counts.");
        return;
      }

      const otherParticipants = currentChat.participants.filter(
        (pId) => pId !== this.state.loggedInUser.id
      );

      // Prepare the updates for the parent chat document
      const updates = {
        lastMessage: messageText,
        lastMessageTimestamp: Timestamp.now(),
      };

      // Increment the unread count for every other participant
      otherParticipants.forEach((pId) => {
        updates[`unreadCount.${pId}`] = increment(1);
      });

      await updateDoc(chatRef, updates);
      // --- END: MODIFIED SECTION ---
    } catch (error) {
      console.error("Error sending message:", error);
      this.showModal("error", "Message Error", "Failed to send message.");

      this.state.currentChatMessages = this.state.currentChatMessages.filter(
        (msg) => msg.id !== optimisticMessage.id
      );
      this.render();
    }
  };

  // Listens to real-time updates for the current user's chats list

  this.listenToUserChats = () => {
    if (!this.state.loggedInUser) {
      console.log("No logged in user, skipping chat listener");
      return;
    }

    // The .orderBy clause has been removed from this query to prevent the indexing error.
    const q = query(
      collection(this.fb.db, this.paths.chats),
      where("participants", "array-contains", this.state.loggedInUser.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log("Chats snapshot received:", snapshot.docs.length);
        this.state.chats = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("Chats updated:", this.state.chats);
        if (
          this.state.currentPage === "messages" &&
          !this.state.currentChatId
        ) {
          this.render();
        }
      },
      (error) => {
        console.error("Error listening to user chats:", error);
      }
    );

    this.state.chatListeners.push(unsubscribe);
  };

  // Detaches all chat-related real-time listeners
  this.detachChatListeners = () => {
    this.state.chatListeners.forEach((unsubscribe) => unsubscribe());
    this.state.chatListeners = [];
  };

  // Helper to format timestamps for display
  this.formatTimestamp = (timestamp, includeTime = false) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const options = { month: "short", day: "numeric" };
    if (includeTime) {
      options.hour = "2-digit";
      options.minute = "2-digit";
      options.hour12 = true;
    }
    return date.toLocaleString("en-US", options);
  };

  // Helper to format timestamps for relative time
  this.formatRelativeTime = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return "never";
    const now = new Date();
    const date = timestamp.toDate();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y ago`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo ago`;
    interval = seconds / 86400;
    if (interval > 1) return `Offline`; // Simplified for clarity
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h ago`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m ago`;
    return "Online"; // If less than a minute, assume online
  };

  // ... rest of methods ...

  // --- FIREBASE INSTANCES ---
  this.fb = {
    app: null,
    auth: null,
    db: null,
    rtdb: null,
  };

  // --- Firestore collection paths ---
  const appId = typeof __app_id !== "undefined" ? __app_id : "bbgs-pride-pass"; // Fallback for local dev
 this.deferredInstallPrompt = null;

  this.paths = {
    users: `artifacts/${appId}/users`,
    userDoc: (uid) => `artifacts/${appId}/users/${uid}`,
    events: `artifacts/${appId}/public/data/events`,
    eventDoc: (eventId) => `artifacts/${appId}/public/data/events/${eventId}`,
    rewards: `artifacts/${appId}/public/data/rewards`,
    rewardDoc: (rewardId) =>
      `artifacts/${appId}/public/data/rewards/${rewardId}`,
    announcements: `artifacts/${appId}/public/data/announcements`,
    badges: `artifacts/${appId}/public/data/badges`,
    badgeDoc: (badgeId) => `artifacts/${appId}/public/data/badges/${badgeId}`,
    rsvps: (userId) => `artifacts/${appId}/users/${userId}/rsvps`,
    checkIns: `artifacts/${appId}/public/data/checkIns`,
    pointLogs: (userId) => `artifacts/${appId}/users/${userId}/pointLogs`,
    claimedRewards: (userId) =>
      `artifacts/${appId}/users/${userId}/claimedRewards`,
    earnedBadges: (userId) => `artifacts/${appId}/users/${userId}/earnedBadges`,
    mapSpots: `artifacts/${appId}/public/data/mapSpots`, // <-- ADD THIS LINE
    systemLogs: `artifacts/${appId}/public/data/systemLogs`, // New path for audit logs
    chats: `artifacts/${appId}/chats`,
    chatDoc: (chatId) => `artifacts/${appId}/chats/${chatId}`,
    messages: (chatId) => `artifacts/${appId}/chats/${chatId}/messages`,
  };

  // --- DOM ELEMENTS ---
  this.elements = {
    mainContent: document.getElementById("main-content"),
    appHeader: document.getElementById("app-header"),
    appNav: document.getElementById("app-nav"),
    adminNavButton: document.getElementById("admin-nav-button"),
    userNameHeader: document.getElementById("user-name-header"),
    userPointsHeader: document.getElementById("user-points-header"),
    modal: document.getElementById("modal"),
    modalIcon: document.getElementById("modal-icon"),
    modalTitle: document.getElementById("modal-title"),
    modalMessage: document.getElementById("modal-message"),
    modalButtons: document.getElementById("modal-buttons"),
    fullscreenModal: document.getElementById("fullscreen-modal"),
    fullscreenModalTitle: document.getElementById("fullscreen-modal-title"),
    fullscreenModalContent: document.getElementById("fullscreen-modal-content"),
    loadingOverlay: document.getElementById("loading-overlay"),
    loadingText: document.getElementById("loading-text"),
    appContainer: document.getElementById("app"),
  };

  this.map = null; // <-- ADD THIS LINE

  // --- TEMPLATES / VIEWS ---
  this.templates = {
    // ANNOUNCEMENT PAGE
    announcements: () => {
      const announcementsHTML = this.state.announcements
        .map((ann) => {
          // Format the timestamp to a readable date
          const date = ann.timestamp?.toDate
            ? ann.timestamp.toDate().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "No date";

          return `
      <div class="announcement-item" onclick="app.toggleAnnouncement(this)">
          <h4 class="font-bold text-lg text-white">${
            ann.title || ann.timestamp
          }</h4>
          <p class="text-xs text-gray-400 mt-1">${ann.timestamp}</p>
          <div class="announcement-content">
              <div class="border-t border-gray-600 my-3"></div>
              <p class="text-sm text-gray-200 whitespace-pre-wrap">${
                ann.message
              }</p>
          </div>
      </div>
    `;
        })
        .join("");

      return `
      <div class="p-4">
          <h1 class="text-2xl font-bold text-center mb-6">List of Announcements</h1>
          <div class="space-y-3">
              ${
                announcementsHTML.length > 0
                  ? announcementsHTML
                  : '<p class="text-center text-gray-400">No announcements found.</p>'
              }
          </div>
      </div>
  `;
    },

    // MESSAGE PAGE
    messages: () => {
      console.log("Rendering messages template");
      console.log("Chats:", this.state.chats);
      console.log("Current chat ID:", this.state.currentChatId);
      const user = this.state.loggedInUser;
      if (!user)
        return `<p class="text-center text-gray-400">Please log in to view messages.</p>`;

      const currentChat = this.state.chats.find(
        (chat) => chat.id === this.state.currentChatId
      );
      let chatPartner = null;
      if (currentChat && currentChat.type === "direct") {
        const otherParticipantId = currentChat.participants.find(
          (pId) => pId !== user.id
        );
        chatPartner = this.state.users.find((u) => u.id === otherParticipantId);
      }

      return `
    <div class="flex flex-col h-full">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold">${
          this.state.currentChatId
            ? chatPartner
              ? chatPartner.firstName + " " + chatPartner.lastName
              : "Chat"
            : "Messages"
        }</h2>

        ${
          chatPartner
            ? `
                <div class="flex items-center space-x-2">
  <div class="w-2 h-2 rounded-full ${
    this.isUserOnline(chatPartner.lastSeen) ? "bg-green-400" : "bg-gray-500"
  }"></div>
  <p class="text-xs text-gray-400">${
    this.isUserOnline(chatPartner.lastSeen)
      ? "Online"
      : `Last seen: ${this.formatTimestamp(chatPartner.lastSeen, true)}`
  }</p>
</div>
                `
            : ""
        }
        </div>
        ${
          this.state.currentChatId
            ? `
          <button onclick="app.closeChat()" class="bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-600">
            <i data-lucide="arrow-left"></i>
            <span>Back to Chats</span>
          </button>
        `
            : ""
        }
      </div>

      <div id="chat-list-view" class="${
        this.state.currentChatId ? "hidden" : ""
      } flex-grow overflow-y-auto no-scrollbar space-y-2">
        ${
          this.state.chats.length > 0
            ? this.state.chats
                .sort(
                  (a, b) =>
                    (b.lastMessageTimestamp?.toDate() || 0) -
                    (a.lastMessageTimestamp?.toDate() || 0)
                )
                // In script.js, inside this.templates.messages

                // ...
                .map((chat) => {
                  const otherParticipantId = chat.participants.find(
                    (pId) => pId !== user.id
                  );
                  const chatUser = this.state.users.find(
                    (u) => u.id === otherParticipantId
                  );
                  if (!chatUser) return "";

                  // --- START: MODIFIED SECTION ---
                  // 1. Get the unread count for the logged-in user
                  const unreadCount = chat.unreadCount
                    ? chat.unreadCount[user.id] || 0
                    : 0;

                  // 2. Truncate the last message preview
                  const messageText =
                    chat.lastMessage || "Start a conversation...";
                  const truncatedMessage =
                    messageText.length > 28
                      ? messageText.substring(0, 28) + "..."
                      : messageText;

                  return `
       <div onclick="app.openChat('${
         chat.id
       }')" class="bg-gray-700 p-3 rounded-lg flex items-center space-x-3 cursor-pointer hover:bg-gray-600">
        <div class="relative">
            <img src="${
              chatUser.profilePic
            }" class="w-12 h-12 rounded-full object-cover">
            <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700 ${
              this.isUserOnline(chatUser.lastSeen)
                ? "bg-green-400"
                : "bg-gray-500"
            }"></div>
        </div>
        <div class="flex-1 overflow-hidden">
          <p class="font-semibold">${chatUser.firstName} ${
                    chatUser.lastName
                  }</p>
          <p class="text-sm ${
            unreadCount > 0 ? "text-white font-bold" : "text-gray-400"
          } truncate">${truncatedMessage}</p>
        </div>
        <div class="flex flex-col items-end space-y-1 text-xs">
            ${
              chat.lastMessageTimestamp
                ? `<p class="text-gray-500 whitespace-nowrap">${this.formatTimestamp(
                    chat.lastMessageTimestamp
                  )}</p>`
                : ""
            }
            ${
              unreadCount > 0
                ? `<span class="bg-pink-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center">${
                    unreadCount > 9 ? "9+" : unreadCount
                  }</span>`
                : ""
            }
        </div>
      </div>
    `;
                  // --- END: MODIFIED SECTION ---
                })
                .join("")
            : // ...
              '<p class="text-center text-gray-400 py-8">No conversations yet. Start one from the directory!</p>'
        }
      </div>

      <div id="active-chat-view" class="${
        this.state.currentChatId ? "" : "hidden"
      } flex flex-col h-full">
        <div id="messages-container" class="flex-grow overflow-y-auto no-scrollbar p-2 space-y-3 bg-gray-800 rounded-lg mb-3">
          ${
            !this.state.allMessagesLoaded
              ? `<button onclick="app.loadMoreMessages()" class="text-center w-full theme-text-accent mb-4">View previous conversation</button>`
              : ""
          }
   ${
     this.state.currentChatMessages.length > 0
       ? this.state.currentChatMessages
           .map((msg) => {
             const isSender = msg.senderId === user.id;
             const senderUser = this.state.users.find(
               (u) => u.id === msg.senderId
             );
             if (msg.id.startsWith("temp_") && msg.error) return "";
             return `
                   <div class="flex items-end space-x-2 group ${
                     isSender ? "justify-end" : "justify-start"
                   }">
                    ${
                      isSender
                        ? `
                    <button onclick="app.unsendMessage('${this.state.currentChatId}', '${msg.id}')" class="unsend-button opacity-0 group-hover:opacity-100 transition-opacity">
                        <i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-400"></i>
                    </button>
                    `
                        : ""
                    }

                    ${
                      !isSender && senderUser
                        ? `<img src="${senderUser.profilePic}" class="w-8 h-8 rounded-full object-cover">`
                        : ""
                    }
                    <div class="max-w-[70%] p-3 rounded-xl ${
                      isSender
                        ? "chat-bubble-sender rounded-br-none"
                        : "chat-bubble-receiver rounded-bl-none"
                    }">
                        <p class="text-sm ${
                          msg.isRemoved ? "italic text-red-400" : ""
                        }">
  ${msg.isRemoved ? "This message was removed." : msg.text}
</p>
                        <p class="text-xs text-gray-300 text-right mt-1">${this.formatTimestamp(
                          msg.timestamp,
                          true
                        )}</p>
                    </div>
                    ${
                      isSender
                        ? `<img src="${user.profilePic}" class="w-8 h-8 rounded-full object-cover">`
                        : ""
                    }
                </div>
                `;
           })
           .join("")
       : '<p class="text-center text-gray-400 py-8">Say hello!</p>'
   }
        </div>

        <form id="chat-input-form" class="flex space-x-2 p-2 bg-gray-900 rounded-lg" onsubmit="app.sendMessage(event)">
          <input type="text" name="messageText" placeholder="Type a message..." class="flex-grow bg-gray-700 rounded-lg p-3 outline-none text-white" autocomplete="off" required>
          <button type="submit" class="chat-send-button text-white p-3 rounded-lg">
            <i data-lucide="send"></i>
          </button>
        </form>
      </div>
    </div>
  `;
    },

    //LOGIN PAGE

    auth: () => `
            <div class="relative h-full">
            <!--
                <div class="absolute top-0 right-0">
                    <button onclick="app.navigateTo('about')" class="p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 transition-colors">
                        <i data-lucide="info" class="w-6 h-6 text-white"></i>
                    </button>
                </div>
                -->
                <div class="text-center">
                    <img src="bipsu_new-min.ico" alt="BBGS Logo" class="w-24 h-24 rounded-2xl mx-auto mb-4 object-cover">
                    <h1 class="text-3xl font-bold mb-2">Welcome to <span class="pride-gradient-text">iBiPSU Pass</span></h1>
                    <p class="text-gray-400 mb-8">Connecting Our Community, One Scan at a Time.</p>
                </div>
                <div x-data="{ tab: 'login' }" class="bg-gray-900 rounded-xl p-2">
                    <div class="flex space-x-2 mb-4">
                    <button @click="tab = 'login'" :class="{ 'pride-gradient-bg text-white': tab === 'login', 'bg-gray-700 text-gray-300': tab !== 'login' }" class="flex-1 py-2 rounded-lg font-semibold transition-all">Log In</button>
                    <button @click="tab = 'register'" :class="{ 'pride-gradient-bg text-white': tab === 'register', 'bg-gray-700 text-gray-300': tab !== 'register' }" class="flex-1 py-2 rounded-lg font-semibold transition-all">Register</button></div>
                      

                  <!-- LOGIN FORM -->
<div x-show="tab === 'login'">
    <form id="login-form" class="space-y-4 p-4">
        <input name="email" type="email" placeholder="Email Address" required class="w-full bg-gray-700 border-2 border-transparent focus:border-pink-500 rounded-lg p-3 outline-none transition-all">
        <input name="password" type="password" placeholder="Password" required class="w-full bg-gray-700 border-2 border-transparent focus:border-pink-500 rounded-lg p-3 outline-none transition-all">
        <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold transition-transform duration-200 active:scale-95">Log In</button>
        
     

        <!-- This button is for Chrome/Android -->
                  <button 
                    type="button" 
                    id="install-app-button" 
                    onclick="app.handleInstallClick()" 
                    class="flex items-center justify-center w-full bg-green-600 text-white py-3 rounded-lg font-semibold transition-transform duration-200 active:scale-95 hover:bg-indigo-700 text-center text-sm"
                    style="display: none;"
                  >
                    <i data-lucide="arrow-down-to-line" class="w-4 h-4 mr-2"></i>
                    <span>Save App on your Home Screen</span>
                  </button>

                  <!-- This button is ONLY for iOS/Safari -->
                  <button 
                    type="button" 
                    id="ios-install-button" 
                    onclick="app.showIosInstallInstructions()" 
                    class="flex items-center justify-center w-full bg-sky-600 text-white py-3 rounded-lg font-semibold transition-transform duration-200 active:scale-95 hover:bg-sky-700 text-center text-sm"
                    style="display: none;"
                  >
                    <i data-lucide="arrow-down-to-,line" class="w-4 h-4 mr-2"></i>
                    <span>Save App on Home Screen</span>
                  </button>

            <!--
              
                <a href="http://tinyurl.com/PridePassApp" target="_blank" class="flex items-center justify-center w-full bg-green-600 text-white py-3 rounded-lg font-semibold transition-transform duration-200 active:scale-95 hover:bg-green-700 text-center text-sm">
                    <i data-lucide="smartphone" class="w-4 h-4 mr-2"></i>
                    <span>Download App</span>
                </a>
            -->

        <!-- START: Added App Notice Section -->
        <div x-data="{ showNotice: false }" class="pt-2 text-center">
            <!--
            <p class="text-xs text-gray-500 italic">
                App not on Google Play / App Store? 
                <button type="button" @click="showNotice = !showNotice" class="text-blue-400 underline hover:text-blue-300">Find out why</button>
            </p>
            -->
            
            <div x-show="showNotice" style="display: none;" class="mt-3 text-left p-3 bg-gray-800 rounded-lg border border-gray-700">

                <!-- First Paragraph -->
                <p class="text-xs text-gray-300 leading-relaxed text-justify indent-5">
                    We are currently working to bring our app to the Google Play Store and Apple App Store. This process requires a developer registration fee, and as a project with budget constraints, we are not there yet.
                </p>

                <!-- Second Paragraph (with spacing above it) -->
                <p class="text-xs text-gray-300 leading-relaxed text-justify indent-5 mt-2">
                    In the meantime, you can get the full app experience by downloading it directly from our site or by using the "Add to Home Screen" feature in your browser. We are actively looking for sponsors and donations to help us complete this final step. Your support is greatly appreciated as we work to make the app more accessible for everyone.
                </p>

                <!-- Third Paragraph (with the link) -->
                <p class="text-xs text-gray-300 leading-relaxed text-justify indent-5 mt-2">
                    You may also download this app externally on your Android devices&nbsp;
                    <a href="http://tinyurl.com/PridePassApp" target="_blank" class="inline-flex items-center align-middle text-green-400 font-semibold hover:underline">
                        <i data-lucide="smartphone" class="w-4 h-4 mr-1"></i>Download App Manually in Andriod Device
                    </a>.
                </p>
            </div>

        </div>
        <!-- END: Added App Notice Section -->

        <!-- CANVA VIDEO 
        <div style="position: relative; width: 100%; height: 0; padding-top: 100.0000%; padding-bottom: 0; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden; border-radius: 8px; will-change: transform;">
            <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;" src="https://www.canva.com/design/DAGyyOxfOro/C22eWaeHJAsyy3SSkP89vA/watch?embed&autoplay=1"></iframe>
        </div>
        -->
        <!--
       <div class="text-center my-8">
    <a href="https://www.facebook.com/bbgsofficial" target="_blank" class="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-semibold hover:bg-blue-700 transition-colors shadow-md text-xs">
        <i data-lucide="facebook" class="w-4 h-4"></i>
        <span>Follow Us</span>
    </a>
    </div>
    -->
    </form>
</div>
                    
                   <!-- REGISTER FORM -->
<div x-show="tab === 'register'" style="display: none;">
    <form id="register-form" class="space-y-4 p-4" x-data="{ gender: '', pronouns: '', orientation: '' }">
        <div class="grid grid-cols-2 gap-4">
            <input name="firstName" type="text" placeholder="First Name*" required class="w-full bg-gray-700 rounded-lg p-3">
            <input name="lastName" type="text" placeholder="Last Name*" required class="w-full bg-gray-700 rounded-lg p-3">
            
        </div>
<input name="studentid" type="text" placeholder="Student ID" class="w-full bg-gray-700 rounded-lg p-3">
        <!-- START: New Inclusive Fields -->
        <div>
            <label class="text-sm text-gray-400">Pronouns*</label>
            <select name="pronouns" x-model="pronouns" required class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                <option value="" disabled>Select your pronouns...</option>
                <option value="She/Her">She/Her</option>
                <option value="He/Him">He/Him</option>
                <option value="They/Them">They/Them</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
            <input x-show="pronouns === 'Other'" type="text" name="pronounsOther" placeholder="Please specify your pronouns" class="w-full bg-gray-700 rounded-lg p-3 mt-2">
        </div>

        <div>
            <label class="text-sm text-gray-400">Gender Identity*</label>
            <select name="gender" x-model="gender" required class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                <option value="" disabled>Select your gender identity...</option>
                <option value="Woman">Woman</option>
                <option value="Man">Man</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Transgender">Transgender</option>
                <option value="Questioning">Questioning</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
            <input x-show="gender === 'Other'" type="text" name="genderOther" placeholder="Please specify your gender" class="w-full bg-gray-700 rounded-lg p-3 mt-2">
        </div>
        
        <div>
            <label class="text-sm text-gray-400">Sexual Orientation (Optional)</label>
            <select name="orientation" x-model="orientation" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                <option value="">Select your orientation...</option>
                <option value="Lesbian">Lesbian</option>
                <option value="Gay">Gay</option>
                <option value="Bisexual">Bisexual</option>
                <option value="Pansexual">Pansexual</option>
                <option value="Asexual">Asexual</option>
                <option value="Queer">Queer</option>
                <option value="Straight">Straight / Heterosexual</option>
                <option value="Questioning">Questioning</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
            <input x-show="orientation === 'Other'" type="text" name="orientationOther" placeholder="Please specify your orientation" class="w-full bg-gray-700 rounded-lg p-3 mt-2">
        </div>
        <!-- END: New Inclusive Fields -->

        <input name="skills" type="text" placeholder="Skills/Talents (e.g., Host, Singer)" required class="w-full bg-gray-700 rounded-lg p-3">
        <input name="contact" type="tel" placeholder="Contact Number*" required class="w-full bg-gray-700 rounded-lg p-3">
        <input name="email" type="email" placeholder="Email Address*" required class="w-full bg-gray-700 rounded-lg p-3">
        <input name="password" type="password" placeholder="Password*" required class="w-full bg-gray-700 rounded-lg p-3">
        <div class="flex items-start">
            <input 
                id="terms" 
                name="terms" 
                type="checkbox" 
                onchange="app.handleTermsChange(this.checked)" 
                class="h-4 w-4 mt-1 accent-pink-600 border-gray-500 rounded focus:ring-pink-500"
            >
            <label for="terms" class="ml-2 text-sm text-gray-400">
                I agree to the <a href="#" onclick="event.preventDefault(); app.showTermsModal()" class="text-yellow-400 hover:underline">Terms and Conditions</a>.
            </label>
        </div>
        <!-- END: Added Terms & Conditions Checkbox -->

        <!-- The button is now disabled by default and has an ID -->
        <button 
            id="register-button" 
            type="submit" 
            disabled 
            class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold transition-all duration-200 opacity-50 cursor-not-allowed"
        >Create My Account</button>
    </form>
</div>

                </div>
            </div>`,

    //MAIN DASHBOARD OF ALL
    dashboard: () => {
      const user = this.state.loggedInUser;

      if (!user.isValidated) {
        return `
        <div class="text-center p-6 bg-gray-900/50 rounded-xl">
            <i data-lucide="shield-alert" class="w-16 h-16 mx-auto text-amber-400 mb-4"></i>
            <h2 class="text-2xl font-bold mb-2">Account Pending Approval</h2>
            <p class="text-gray-400">Your account is registered. An administrator will review it shortly, granting full access upon approval.</p>
            <div style="position: relative; width: 100%; height: 0; padding-top: 177.7778%;padding-bottom: 0; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden;border-radius: 8px; will-change: transform;">
              <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;"
            src="https://www.canva.com/design/DAGy3ERSjCo/4e2CdzmxIShB6KdG7Jui2w/view?embed" allowfullscreen="allowfullscreen" allow="fullscreen">
            </iframe>
            </div>
        </div>
      `;
      }

      // This part remains the same and now works perfectly with your coding style
      return `
    <div class="space-y-4">
    <!--
      ${this.renderDashboardCarousel()}
     -->
      ${this.renderDashboardDailyRewards()}
      ${this.renderDashboardProfile(user)}
      ${this.renderDashboardActions()}
      ${this.renderDashboardAnnouncement()}
      
    </div>
  `;
    },

    //DASHBOARD USER GUIDE
    userguide: () => {
      return `
            <div class="p-4">
                <div class="flex items-center mb-6">
                    <button onclick="app.navigateTo('dashboard')" class="p-2 rounded-full hover:bg-gray-700">
                        <i data-lucide="arrow-left" class="w-6 h-6"></i>
                    </button>
                    <h2 class="text-2xl font-bold ml-4">User Guide</h2>
                </div>
                <div style="position: relative; width: 100%; height: 0; padding-top: 177.7778%;padding-bottom: 0; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden;border-radius: 8px; will-change: transform;">
                  <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;"
                  src="https://www.canva.com/design/DAGy3ERSjCo/4e2CdzmxIShB6KdG7Jui2w/view?embed" allowfullscreen="allowfullscreen" allow="fullscreen">
                  </iframe>
                </div>
            </div>
        `;
    },

    //LARO
    games: () => {
      const gamesList = [
        {
          name: "Merge Brainrot",
          url: "https://www.onlinegames.io/merge-brainrot",
        },
        {
          name: "Idle Mining Empire",
          url: "https://now.gg/apps/marketjs/50010/idle-mining-empire.html",
        },
      ];

      return `
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold">Games</h2>
            <button onclick="app.navigateTo('dashboard')" class="bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-600">
                <i data-lucide="arrow-left"></i>
                <span>Back</span>
            </button>
        </div>
         <div class="space-y-4">
            ${gamesList
              .map(
                (game) => `
                <div class="bg-gray-700 p-4 rounded-lg">
                    <h3 class="text-lg font-bold">${game.name}</h3>
                    <button onclick="app.loadGame('${game.url}')" class="text-blue-400 hover:underline">Play Now</button>
                </div>
            `
              )
              .join("")}
        </div>
        <div id="game-container" class="mt-4">
    <iframe id="game-iframe" src="" width="100%" height="600px" style="border: none;"></iframe>
    <button id="exit-fullscreen" style="display: none;" onclick="app.exitFullScreen()">Exit Full Screen</button>
</div>

    `;
    },

    facebookFeed: () => `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">Facebook Updates</h2>
                <button onclick="app.navigateTo('dashboard')" class="bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-600">
                    <i data-lucide="arrow-left"></i>
                    <span>Back</span>
                </button>
            </div>
            <div class="bg-white rounded-lg overflow-hidden">
                <div class="fb-page" 
                     data-href="https://www.facebook.com/BBGSofficial" 
                     data-tabs="timeline" 
                     data-small-header="false" 
                     data-adapt-container-width="true" 
                     data-hide-cover="false" 
                     data-show-facepile="true">
                    <blockquote cite="https://www.facebook.com/BBGSofficial" class="fb-xfbml-parse-ignore">
                        <a href="https://www.facebook.com/BBGSofficial">Biliran Bisexual and Gay Society - BBGS</a>
                    </blockquote>
                </div>
            </div>
        `,

    events: () => {
      return `
            <div x-data="{ view: 'calendar' }">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">Events</h2>
                    <div class="bg-gray-900/50 p-1 rounded-lg flex space-x-1">
                        <button @click="view = 'calendar'" :class="{ 'bg-gray-700': view === 'calendar' }" class="p-2 rounded-md"><i data-lucide="calendar"></i></button>
                        <button @click="view = 'list'" :class="{ 'bg-gray-700': view === 'list' }" class="p-2 rounded-md"><i data-lucide="list"></i></button>
                    </div>
                </div>

                <div x-show="view === 'calendar'">
                    ${this.generateCalendar()}
                </div>

                <div x-show="view === 'list'" style="display: none;">
                    <div class="space-y-4">
                    ${
                      this.state.events
                        .filter((e) => e.isVisible)
                        .map((event) => {
                          const hasRSVPd = this.state.rsvps.some(
                            (rsvp) => rsvp.eventId === event.id
                          );
                          const badge = event.badgeId
                            ? this.state.badges.find(
                                (b) => b.id === event.badgeId
                              )
                            : null;
                          return `
                        <div class="bg-gray-700 p-4 rounded-lg">
                            <h3 class="text-lg font-bold">${event.name}</h3>
                            <p class="text-sm text-amber-400 mb-2">+${
                              event.points
                            } Points for attending</p>
                            <p class="text-gray-300 text-sm mb-4">${
                              event.description || "No description available."
                            }</p>
                            ${
                              badge
                                ? `
                            <div class="border-t border-gray-600 my-3 pt-3 flex items-center space-x-2">
                                ${this.renderBadgeIcon(
                                  badge.icon,
                                  "w-5 h-5 text-amber-400"
                                )}
                                <p class="text-xs text-gray-300">Unlocks the "${
                                  badge.name
                                }" badge!</p>
                            </div>
                            `
                                : ""
                            }
                            <button onclick="app.handleRsvp('${
                              event.id
                            }')" class="${
                            hasRSVPd
                              ? "bg-green-500/20 text-green-400"
                              : "pride-gradient-bg text-white"
                          } w-full py-2 rounded-lg font-semibold text-sm">
                                ${hasRSVPd ? "✓ RSVP'd" : "RSVP Now"}
                            </button>
                        </div>
                        `;
                        })
                        .join("") ||
                      '<p class="text-gray-400 text-center">No upcoming events. Check back soon!</p>'
                    }
                    </div>
                </div>
            </div>
            `;
    },

    rewards: () => {
      return `
            <h2 class="text-2xl font-bold text-center mb-6">Available Rewards</h2>
            <div class="space-y-4">
            ${this.state.rewards
              .filter((r) => r.isVisible)
              .map((reward) => {
                const badge = reward.badgeId
                  ? this.state.badges.find((b) => b.id === reward.badgeId)
                  : null;
                const limitText =
                  reward.claimLimitType === "limited"
                    ? `${reward.claimsLeft} / ${reward.claimLimit} left`
                    : "";
                return `
                <div class="bg-gray-700 p-4 rounded-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-lg font-bold">${reward.name}</h3>
                            <p class="text-sm ${
                              reward.type === "cost"
                                ? "text-red-400"
                                : "text-green-400"
                            }">${reward.type === "cost" ? "-" : "+"}${
                  reward.cost
                } Points</p>
                            ${
                              limitText
                                ? `<p class="text-xs text-gray-400 mt-1">${limitText}</p>`
                                : ""
                            }
                        </div>
                        <button onclick="app.showModal('info', 'How to Claim', 'Scan this reward\\'s QR code at an official BBGS event or with an admin to claim.')" class="bg-gray-600 p-2 rounded-lg"><i data-lucide="help-circle"></i></button>
                    </div>
                    ${
                      badge
                        ? `
                    <div class="border-t border-gray-600 mt-3 pt-3 flex items-center space-x-2">
                        ${this.renderBadgeIcon(
                          badge.icon,
                          "w-5 h-5 text-amber-400"
                        )}
                        <p class="text-xs text-gray-300">Also unlocks the "${
                          badge.name
                        }" badge!</p>
                    </div>
                    `
                        : ""
                    }
                </div>
                `;
              })
              .join("")}
            </div>

            <div class="text-center py-6">
                ${
                  this.state.rewardsLoading
                    ? `<div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>`
                    : !this.state.rewardsAllLoaded
                    ? `<button onclick="app.fetchRewards()" class="pride-gradient-bg text-white font-semibold px-6 py-2 rounded-lg transition-transform active:scale-95">Load More</button>`
                    : this.state.rewards.length > 0
                    ? '<p class="text-gray-500">You have reached the end.</p>'
                    : '<p class="text-gray-400 text-center">No rewards available right now.</p>'
                }
            </div>
            `;
    },

    badges: () => {
      const earnedBadges = this.state.badges.filter((b) =>
        this.state.earnedBadges.some((eb) => eb.badgeId === b.id)
      );
      const unearnedBadges = this.state.badges.filter(
        (b) =>
          b.isVisible &&
          !this.state.earnedBadges.some((eb) => eb.badgeId === b.id)
      );

      return `
            <h2 class="text-2xl font-bold text-center mb-6">Achievements</h2>
            
            <div>
                <h3 class="text-lg font-semibold pride-gradient-text mb-3">Earned Badges</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    ${
                      earnedBadges.length > 0
                        ? earnedBadges
                            .map(
                              (badge) => `
                        <div class="badge-item text-center p-2 bg-gray-700 rounded-lg cursor-pointer" 
                             data-name="${badge.name.replace(/"/g, "&quot;")}" 
                             data-description="${badge.description.replace(
                               /"/g,
                               "&quot;"
                             )}"
                             data-icon="${badge.icon}"
                             data-earned="true">
                            ${this.renderBadgeIcon(
                              badge.icon,
                              "w-12 h-12 mx-auto text-amber-400"
                            )}
                            <p class="text-xs mt-2 font-semibold">${
                              badge.name
                            }</p>
                        </div>
                    `
                            )
                            .join("")
                        : '<p class="text-gray-400 text-center col-span-full">No badges earned yet.</p>'
                    }
                </div>
            </div>

            <div class="mt-8">
                <h3 class="text-lg font-semibold pride-gradient-text mb-3">Achievements to Unlock</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    ${
                      unearnedBadges.length > 0
                        ? unearnedBadges
                            .map(
                              (badge) => `
                        <div class="badge-item text-center p-2 bg-gray-700 rounded-lg cursor-pointer opacity-40" 
                             data-name="${badge.name.replace(/"/g, "&quot;")}" 
                             data-description="${badge.description.replace(
                               /"/g,
                               "&quot;"
                             )}"
                             data-icon="${badge.icon}"
                             data-earned="false">
                            ${this.renderBadgeIcon(
                              badge.icon,
                              "w-12 h-12 mx-auto text-gray-500"
                            )}
                            <p class="text-xs mt-2 font-semibold">${
                              badge.name
                            }</p>
                        </div>
                    `
                            )
                            .join("")
                        : '<p class="text-gray-400 text-center col-span-full">No more badges to unlock for now!</p>'
                    }
                </div>
            </div>
            `;
    },

    //DASH MEMBER DIRECTORY
    // In your this.views object, replace the directory function

    directory: () => {
      const filteredUsers = this.state.users.filter(
        (u) =>
          u.isPublic &&
          u.isValidated &&
          u.email !== this.state.adminEmail &&
          ((u.firstName + " " + u.lastName)
            .toLowerCase()
            .includes(this.state.directorySearch) ||
            (u.skills || "").toLowerCase().includes(this.state.directorySearch))
      );

      // --- START: New logic to show only a portion of the users ---
      // We slice the array to get only the number of users we want to display
      const usersToShow = filteredUsers.slice(
        0,
        this.state.directoryDisplayCount
      );
      // --- END: New logic ---

      return `
    <h2 class="text-2xl font-bold text-center mb-4">Member Directory</h2>
    <div class="flex space-x-2 mb-4">
        <input id="directory-search-input" type="search" placeholder="Search by name or skill..." class="w-full bg-gray-700 rounded-lg p-3">
        <button onclick="app.handleDirectorySearch()" class="pride-gradient-bg px-4 rounded-lg"><i data-lucide="search"></i></button>
    </div>
    <div class="space-y-2">
        ${
          // We now map over 'usersToShow' instead of the full 'filteredUsers' array
          usersToShow
            .map((user) => {
              const earnedBadges = (user.earnedBadgeIds || [])
                .map((badgeId) =>
                  this.state.badges.find((b) => b.id === badgeId)
                )
                .filter(Boolean)
                .slice(0, 5);
              const isCurrentUser = user.id === this.state.loggedInUser.id;
              return `
                    <div class="bg-gray-700 p-3 rounded-lg flex items-center space-x-4 cursor-pointer hover:bg-gray-600" onclick="app.openMemberDetailsModal('${
                      user.id
                    }')">
                        <div class="relative">
                            <img src="${
                              user.profilePic
                            }" class="w-12 h-12 rounded-full object-cover">
                            <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700 ${
                              this.isUserOnline(user.lastSeen)
                                ? "bg-green-400"
                                : "bg-gray-500"
                            }"></div>
                        </div>
                        <div class="flex-1">
                            <p class="font-bold">${user.firstName} ${
                user.lastName
              }</p>
                            <p class="text-sm text-gray-400"> ${
                              user.skills && user.skills.length > 15
                                ? user.skills.substring(0, 15) + "..."
                                : user.skills || "No skills listed"
                            }</p>
                        </div>
                        <div class="flex space-x-1">${earnedBadges
                          .map((badge) =>
                            this.renderBadgeIcon(
                              badge.icon,
                              "w-5 h-5 text-amber-400"
                            )
                          )
                          .join("")}</div>
                        ${
                          !isCurrentUser
                            ? `
                            <button onclick="event.stopPropagation(); app.startChatWithUser('${user.id}')" class="bg-blue-500/20 text-blue-400 p-2 rounded-md hover:bg-blue-500/40">
                                <i data-lucide="message-square"></i>
                            </button>
                        `
                            : ""
                        }
                    </div>
                `;
            })
            .join("") ||
          '<p class="text-gray-400 text-center">No members match your search.</p>'
        }
    </div>

    <!-- START: New "Show More" Button Section -->
    ${
      // This checks if there are more users to show than are currently visible
      filteredUsers.length > this.state.directoryDisplayCount
        ? `
            <div class="text-center mt-6">
                <button onclick="app.handleShowMoreDirectory()" class="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                    Show More
                </button>
            </div>
        `
        : "" // If not, render nothing
    }
    <!-- END: New "Show More" Button Section -->
    `;
    },

    leaderboard: () => {
      const rankedUsers = this.state.users
        .filter((u) => u.isValidated)
        .sort((a, b) => b.points - a.points);

      const usersToShow = rankedUsers.slice(
        0,
        this.state.leaderboardDisplayCount
      );
      const currentUser = this.state.loggedInUser;

      return `
            <h2 class="text-2xl font-bold text-center mb-6">Points Leaderboard</h2>
            <div class="space-y-2">
            ${usersToShow
              .map((user, index) => {
                const earnedBadges = (user.earnedBadgeIds || [])
                  .map((badgeId) =>
                    this.state.badges.find((b) => b.id === badgeId)
                  )
                  .filter(Boolean)
                  .slice(0, 20);
                const isCurrentUser = user.id === currentUser.id;

                let rankIndicator = `<span class="text-lg font-bold w-8 text-center">${
                  index + 1
                }</span>`;
                if (index === 0) {
                  rankIndicator = `<img src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHFudzU4aGkxNGRpbG54MG9nbzdqNTZnamN3cXhvZjRvd2V6bmZtZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/ZMVwfXq4d1p3GOx50w/giphy.gif" class="w-15 h-12">`;
                } else if (index === 1) {
                  rankIndicator = `<i data-lucide="trophy" class="w-6 h-6 text-gray-400"></i>`;
                } else if (index === 2) {
                  rankIndicator = `<i data-lucide="trophy" class="w-6 h-6 text-yellow-600"></i>`;
                }

                return `
                <div class="fade-in-item bg-gray-700 p-3 rounded-lg flex items-center space-x-4 ${
                  isCurrentUser ? "border-2 border-pink-500" : ""
                }" style="animation-delay: ${index * 50}ms;">
  <div class="w-8 flex justify-center">${rankIndicator}</div>
  <div class="relative">
    <img src="${user.profilePic}" class="w-12 h-12 rounded-full object-cover">
    <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-700 ${
      this.isUserOnline(user.lastSeen) ? "bg-green-400" : "bg-gray-500"
    }"></div>
  </div>
  <div class="flex-1">
    <p class="font-bold">${user.firstName} ${user.lastName}</p>
    <div class="flex space-x-1 mt-1">
      </div>
  </div>
  <p class="font-bold text-amber-400">${user.points} PTS</p>
</div>
                `;
              })
              .join("")}
            </div>
            <div class="text-center py-6 h-12">
                ${
                  this.state.leaderboardLoading
                    ? `<div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500"></div>`
                    : this.state.leaderboardDisplayCount < rankedUsers.length
                    ? `<button onclick="app.loadMoreLeaderboard()" class="pride-gradient-bg text-white font-semibold px-6 py-2 rounded-lg transition-transform active:scale-95">Show More</button>`
                    : rankedUsers.length > 0
                    ? '<p class="text-gray-500">You have reached the end.</p>'
                    : ""
                }
            </div>
            `;
    },

    scanner: () =>
      `<div class="text-center"><h2 class="text-2xl font-bold mb-2">Scan QR Code</h2><p class="text-gray-400 mb-4">Scan an event or reward QR code.</p><div id="qr-reader" class="w-full rounded-2xl overflow-hidden border-4 border-gray-700"></div><p id="qr-reader-status" class="mt-4 text-sm text-gray-400">Initializing camera...</p></div>`,

    qrSpots: () => `
            <h2 class="text-2xl font-bold text-center mb-4">QR Code Spots</h2>
            <p class="text-gray-400 text-center mb-4">Explore the map to find locations for events, rewards, and badges.</p>
            <div id="user-map" class="w-full h-96 rounded-xl border-2 border-gray-700"></div>
        `,
    about: () => `
            ${
              !this.state.loggedInUser
                ? `
            <div class="mb-4 text-right">
                <button onclick="app.navigateTo('auth')" class="bg-gray-700 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 ml-auto hover:bg-gray-600">
                    <i data-lucide="x"></i>
                    <span>Close</span>
                </button>
            </div>
            `
                : ""
            }
            <h2 class="text-2xl font-bold text-center mb-6">About iBiPSU Pass</h2>
            <div class="space-y-8 bg-gray-900/50 p-6 rounded-xl">
                
                <!-- Section 1: What is iBiPSU Pass? -->
                <div  style="text-align: justify;">
                    <div class="flex items-center space-x-3 mb-2">
                        <i data-lucide="sparkles" class="w-6 h-6 text-pink-400"></i>
                        <h3 class="font-semibold text-lg text-pink-400">Your Community Hub</h3>
                    </div>
                    <p class="text-gray-300" style="text-indent: 30px;">
                        The iBiPSU Pass, a pioneering digital initiative by the Biliran Bisexual and Gay Society, is a powerful tool for LGBTQIAP+ individuals and allies alike. It serves as your all-in-one community pass, leveraging an innovative QR code system to enhance connectivity, streamline event check-ins, and facilitate seamless integration within the vibrant Biliran community. Embrace inclusivity, embrace empowerment, embrace the future with the Pride Pass.
                    </p>
                </div>

                <!-- Section 2: Key Features Grid -->
                <div>
                    <div class="flex items-center space-x-3 mb-3">
                        <i data-lucide="star" class="w-6 h-6 text-purple-400"></i>
                        <h3 class="font-semibold text-lg text-purple-400">Key Features</h3>
                    </div>
                    <div class="grid grid-cols-4 gap-3 text-center">
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="award" class="mx-auto mb-1"></i><span class="text-xs">Points & Badges</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="bar-chart-3" class="mx-auto mb-1"></i><span class="text-xs">Leaderboard</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="calendar-heart" class="mx-auto mb-1"></i><span class="text-xs">Event RSVPs</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="gift" class="mx-auto mb-1"></i><span class="text-xs">Exclusive Rewards</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="qr-code" class="mx-auto mb-1"></i><span class="text-xs">QR Code Scanning</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="map-pinned" class="mx-auto mb-1"></i><span class="text-xs">Pin Mapping</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="gamepad-2" class="mx-auto mb-1"></i><span class="text-xs">Digital Games</span></div>
                        <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="messages-square" class="mx-auto mb-1"></i><span class="text-xs">Messanging</span></div>
                         <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="handshake" class="mx-auto mb-1"></i><span class="text-xs">Community Directory</span></div>
                         <div class="bg-gray-700 p-2 rounded-lg"><i data-lucide="sparkles" class="mx-auto mb-1"></i><span class="text-xs">... and more</span></div>
                        
                    </div>
                </div>

                <!-- Section 3: Support & Connect -->
                <div>
                    <div class="flex items-center space-x-3 mb-3">
                        <i data-lucide="message-circle-heart" class="w-6 h-6 text-amber-400"></i>
                        <h3 class="font-semibold text-lg text-amber-400">Support & Connect</h3>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-lg flex items-center space-x-4">
                        <img src="https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/236ecf96-a881-428d-9213-83d1c7313131/dkeqp9e-674027e6-268b-416b-bb70-7eb51e3571e8.png/v1/fill/w_1280,h_1811,q_80,strp/tito_amerigo_v__custodio__jr__by_titoycute_dkeqp9e-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9MTgxMSIsInBhdGgiOiJcL2ZcLzIzNmVjZjk2LWE4ODEtNDI4ZC05MjEzLTgzZDFjNzMxMzEzMVwvZGtlcXA5ZS02NzQwMjdlNi0yNjhiLTQxNmItYmI3MC03ZWI1MWUzNTcxZTgucG5nIiwid2lkdGgiOiI8PTEyODAifV1dLCJhdWQiOlsidXJuOnNlcnZpY2U6aW1hZ2Uub3BlcmF0aW9ucyJdfQ.aDSqsbauYY4P_Qtqhkw-hSwt2Fl6T6VjZJpmKa---38" class="w-16 h-16 rounded-full object-cover border-2 border-gray-600">
                        <div>
                            <p class="font-bold text-white">Tito Amerigo V. Custodio, Jr., MIT</p>
                            <p class="text-xs text-gray-300"><i>President, BBGS</i></p>
                            <p class="text-sm text-gray-300">For technical issues or feedback:</p>
                            <a href="mailto:bbgsofficial2021@gmail.com" class="text-sm text-pink-400 hover:underline">bbgsofficial2021@gmail.com</a><br>
                            <a href="tel:09666517133" class="text-sm text-pink-400 hover:underline">09666517133</a>
                        </div>
                    </div>

                </div>
<!--
                <div style="position: relative; width: 100%; height: 0; padding-top: 177.7778%;padding-bottom: 0; box-shadow: 0 2px 8px 0 rgba(63,69,81,0.16); margin-top: 1.6em; margin-bottom: 0.9em; overflow: hidden;border-radius: 8px; will-change: transform;">
                  <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none; padding: 0;margin: 0;"
                  src="https://www.canva.com/design/DAGy3ERSjCo/4e2CdzmxIShB6KdG7Jui2w/view?embed" allowfullscreen="allowfullscreen" allow="fullscreen">
                  </iframe>
                </div>
-->
                <p class="text-center text-xs text-gray-500 pt-4">App Version 2.0.2 (iBiPSU QR Code System) <br> © 2025 BBGS Dev Tootz </p>
            </div>
        `,

    //MY PROFILE
    profile: () => {
      const user = this.state.loggedInUser;
      const earnedBadges = this.state.earnedBadges
        .map((earned) => this.state.badges.find((b) => b.id === earned.badgeId))
        .filter(Boolean);
      return `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">My Profile</h2>
                <button onclick="app.openPointsLogModal()" class="flex items-center space-x-2 bg-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-600"><i data-lucide="history"></i><span>View Log</span></button>
            </div>
            <div class="bg-gray-900/50 p-4 rounded-lg mb-4 text-center">
                <p class="font-semibold">Verification Status:</p>
                ${
                  user.isValidated
                    ? `<p class="text-green-400 font-bold">✓ Verified on ${
                        user.validatedAt || ""
                      }</p>`
                    : '<p class="text-amber-400 font-bold">Pending Approval</p>'
                }
            </div>

            <form id="profile-form">
                <div class="flex flex-col items-center space-y-4 mb-6">
                    <img id="profile-pic-preview" src="${
                      user.profilePic
                    }" class="w-32 h-32 rounded-full object-cover border-4 border-purple-500">
                    <label class="bg-gray-700 px-4 py-2 rounded-lg font-semibold text-sm cursor-pointer hover:bg-gray-600">Change Photo<input type="file" id="profile-pic-upload" class="hidden" accept="image/*"></label>
                </div>
                <div class="space-y-4">
                   <!-- New Subheading -->
                    <h4 class="text-sm font-bold text-gray-400 border-b border-gray-600 pb-1">Public Information</h4>
                    
                    <div><label class="text-sm text-gray-400">Student ID ##-##-#####</label><input name="studentid" value="${
                      user.studentid
                    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div>
                    
                    <div class="grid grid-cols-2 gap-4">
                         <div><label class="text-sm text-gray-400">First Name</label><input name="firstName" value="${
                           user.firstName
                         }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div>
                        <div><label class="text-sm text-gray-400">Last Name</label><input name="lastName" value="${
                          user.lastName
                        }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                      <div>
            <label class="text-sm text-gray-400">Pronouns</label>
            <select name="pronouns" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                <option value="" disabled>Select your pronouns...</option>
                <option value="She/Her">She/Her</option>
                <option value="He/Him">He/Him</option>
                <option value="They/Them">They/Them</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
             </div>

        <div>
            <label class="text-sm text-gray-400">Gender Identity</label>
            <select name="gender" class="w-full bg-gray-700 rounded-lg p-3 mt-1" >
                <option value="" disabled>Select your gender identity...</option>
                <option value="Woman">Woman</option>
                <option value="Man">Man</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Transgender">Transgender</option>
                <option value="Questioning">Questioning</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
             </div>
        
</div>
 <div>
            <label class="text-sm text-gray-400">Sexual Orientation</label>
            <select name="orientation"  class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                <option value="">Select your orientation...</option>
                <option value="Lesbian">Lesbian</option>
                <option value="Gay">Gay</option>
                <option value="Bisexual">Bisexual</option>
                <option value="Pansexual">Pansexual</option>
                <option value="Asexual">Asexual</option>
                <option value="Queer">Queer</option>
                <option value="Straight">Straight / Heterosexual</option>
                <option value="Questioning">Questioning</option>
                <option value="Other">Other / Prefer to self-describe</option>
            </select>
            </div>
                    <div><label class="text-sm text-gray-400">Contact Number</label><input name="contact" value="${
                      user.contact
                    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div>
                    <div><label class="text-sm text-gray-400">Skills/Talents</label><textarea name="skills" value="${
                      user.skills
                    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1">${
        user.skills
      }</textarea></div>


                    <!-- New Subheading -->
                  <div><label class="text-sm text-gray-400">Email</label><input name="email" value="${
                    user.email
                  }" class="w-full bg-gray-600 rounded-lg p-3 mt-1" readonly></div>
                    
                  <div class="bg-gray-900/50 p-4 rounded-lg flex justify-between items-center">
                    <label for="directory-opt-in" class="font-semibold">Show in Member Directory</label>
                    <input type="checkbox" id="directory-opt-in" onchange="app.handleDirectoryOptIn(this.checked)" ${
                      user.isPublic ? "checked" : ""
                    } class="h-6 w-6 rounded-md accent-pink-500">
                         </div>
<!--
                    <div>
                        <label class="text-sm text-gray-400 mb-2 block">App Theme</label>
                        <div class="grid grid-cols-4 gap-3">
                            ${this.renderThemeOption(
                              "default",
                              "Default",
                              "bg-gray-800",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "light",
                              "White Golden",
                              "bg-yellow-200",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "blue",
                              "Blue Spectrum",
                              "bg-blue-600",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "green",
                              "IbidAko",
                              "bg-green-600",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "pink",
                              "Pink Sparkle",
                              "bg-pink-500",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "rainbow2",
                              "DasigNaval",
                              "pride-gradient-bg",
                              user.theme
                            )}
                            ${this.renderThemeOption(
                              "rainbow",
                              "Digital",
                              "bg-black",
                              user.theme
                            )}
                        </div>
                    </div>
                    -->
                </div>
            </form>
            
            <div class="mt-8">
                <h3 class="text-xl font-bold text-center mb-4">My Achievements</h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
                    ${
                      earnedBadges.length > 0
                        ? earnedBadges
                            .map(
                              (badge) => `
                        <div class="badge-item text-center p-2 bg-gray-700 rounded-lg cursor-pointer" data-name="${badge.name.replace(
                          /"/g,
                          "&quot;"
                        )}" data-description="${badge.description.replace(
                                /"/g,
                                "&quot;"
                              )}" data-icon="${badge.icon}" data-earned="true">
                            ${this.renderBadgeIcon(
                              badge.icon,
                              "w-12 h-12 mx-auto text-amber-400"
                            )}
                            <p class="text-xs mt-2 font-semibold">${
                              badge.name
                            }</p>
                        </div>
                    `
                            )
                            .join("")
                        : '<p class="text-gray-400 text-center col-span-full">No badges earned yet. Attend events to get started!</p>'
                    }
                </div>
            </div>

            <button type="submit" form="profile-form" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold mt-8">Save Changes</button>
            <button type="button" onclick="app.handleLogout()" class="w-full bg-red-500/20 text-red-400 py-3 rounded-lg font-semibold mt-4">Log Out</button>
        `;
    },

    admin: () => {
      const unverifiedUsers = this.state.users.filter((u) => !u.isValidated);
      const filteredRewards = this.state.adminRewards.filter(
        (r) =>
          r.name &&
          (typeof r.name === "string") &
            r.name.toLowerCase().includes(this.state.adminRewardSearch)
      );
      const filteredMembers = this.state.users.filter(
        (u) =>
          u.isValidated &&
          u.email !== this.state.adminEmail &&
          (u.firstName + " " + u.lastName)
            .toLowerCase()
            .includes(this.state.adminMemberSearch)
      );
      const editingReward = this.state.adminEditingRewardId
        ? this.state.rewards.find(
            (r) => r.id === this.state.adminEditingRewardId
          )
        : null;

      // Logic for filtering logs
      const filteredLogs = this.state.systemLogs.filter((log) => {
        if (!log.timestamp || !log.timestamp.toDate) return false;
        const logDate = log.timestamp.toDate();
        const { year, month, day } = this.state.logFilter;
        if (year !== "all" && logDate.getFullYear() != year) return false;
        if (month !== "all" && logDate.getMonth() + 1 != month) return false;
        if (day !== "all" && logDate.getDate() != day) return false;
        return true;
      });

      return `

<!-- ADMIN PANEL -->
      <h2 class="text-2xl font-bold text-center mb-6">Admin Panel</h2>
        <div x-data="{ tab: '${
          this.state.adminActiveTab
        }' }" @tab-change.window="tab = $event.detail" class="bg-gray-900 rounded-xl p-2">
          <div class="flex flex-wrap justify-center gap-2 mb-4">

          <!-- ADMIN BUTTONS -->

            <button @click="tab = 'verification'" :class="{ 'pride-gradient-bg text-white': tab === 'verification', 'bg-gray-700 text-gray-300': tab !== 'verification' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Verification 
              <span class="bg-pink-500 text-white text-xs font-bold rounded-full px-2 ml-1">${
                unverifiedUsers.length
              }</span>
            </button>
            <button @click="tab = 'members'" :class="{ 'pride-gradient-bg text-white': tab === 'members', 'bg-gray-700 text-gray-300': tab !== 'members' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Members</button>
            <button @click="tab = 'events'" :class="{ 'pride-gradient-bg text-white': tab === 'events', 'bg-gray-700 text-gray-300': tab !== 'events' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Events</button>
            <button @click="tab = 'rewards'" :class="{ 'pride-gradient-bg text-white': tab === 'rewards', 'bg-gray-700 text-gray-300': tab !== 'rewards' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Rewards</button>
            <button @click="tab = 'badges'" :class="{ 'pride-gradient-bg text-white': tab === 'badges', 'bg-gray-700 text-gray-300': tab !== 'badges' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Badges</button>
            <button @click="tab = 'announcements'" :class="{ 'pride-gradient-bg text-white': tab === 'announcements', 'bg-gray-700 text-gray-300': tab !== 'announcements' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Announce</button>
            <button @click="tab = 'mapSpots'" :class="{ 'pride-gradient-bg text-white': tab === 'mapSpots', 'bg-gray-700 text-gray-300': tab !== 'mapSpots' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Map Spots</button>
            <button @click="tab = 'scan'" :class="{ 'pride-gradient-bg text-white': tab === 'scan', 'bg-gray-700 text-gray-300': tab !== 'scan' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Scan QR</button>
            <button @click="tab = 'logs'" :class="{ 'pride-gradient-bg text-white': tab === 'logs', 'bg-gray-700 text-gray-300': tab !== 'logs' }" class="flex-1 py-2 px-3 rounded-lg font-semibold text-sm">Logs</button>
            
          </div>

      

          <div x-show="tab === 'mapSpots'">
           <div class="mt-4">
            <button onclick="app.openAdminMapPanel()" class="w-full bg-gray-700 hover:bg-gray-600 p-4 rounded-lg flex items-center justify-between">
              <span class="font-semibold text-lg">Manage QR Code Spots</span><i data-lucide="map"></i>
            </button>
            </div>
          </div>
          
          <!-- ADMIN PENDING APPROVAL -->
          <div x-show="tab === 'verification'">
            <h3 class="font-semibold text-lg mb-2 text-center">Pending Approvals</h3>
            <div class="space-y-2">${
              unverifiedUsers
                .map(
                  (user) =>
                    `<div class="bg-gray-700 p-3 rounded-lg">
                <div class="flex items-center justify-between"> 
                  <div class="flex items-center space-x-3"><img src="${user.profilePic}" class="w-10 h-10 rounded-full object-cover">
                    <div>
                      <p class="font-semibold">${user.firstName} ${user.lastName}</p>
                      <p class="text-xs text-gray-400">${user.email}</p>
                    </div>
                  </div>
                  <div class="flex space-x-2">
                      <button onclick="app.handleAdminApproveUser('${user.id}')" class="p-2 bg-green-500/20 text-green-400 rounded-md"><i data-lucide="check"></i></button>
                      <button onclick="app.handleAdminDeleteUser('${user.id}')" class="p-2 bg-red-500/20 text-red-400 rounded-md"><i data-lucide="x"></i></button>
                  </div>
                </div>
              </div>`
                )
                .join("") ||
              '<p class="text-gray-400 text-center py-4">No new users to verify.</p>'
            }
            </div>
          </div>
          
          <!-- ADMIN CREATE EVENT -->
          <div x-show="tab === 'events'">
            <div class="bg-gray-800 p-4 rounded-lg mb-4">
              <h3 class="font-semibold text-lg mb-4">Create New Event</h3>

              <!-- ADMIN CREATE EVENT FORM -->
              <form id="create-event-form" class="space-y-4"><input name="eventName" type="text" placeholder="Event Name" required class="w-full bg-gray-700 rounded-lg p-3">
                <input name="eventDate" type="datetime-local" required class="w-full bg-gray-700 rounded-lg p-3 text-white">
                <textarea name="eventDescription" placeholder="Event Description (optional)" class="w-full bg-gray-700 rounded-lg p-3 h-24"></textarea>
                <input name="eventPoints" type="number" placeholder="Points Value" required class="w-full bg-gray-700 rounded-lg p-3">
                  <select name="badgeId" class="w-full bg-gray-700 rounded-lg p-3">
                    <option value="">No Badge for this Event</option>
                    ${this.state.badges
                      .map(
                        (badge) =>
                          `<option value="${badge.id}">${badge.name}</option>`
                      )
                      .join("")}
                  </select>
                <div class="flex items-center space-x-2">
                  <input type="checkbox" id="event-visible" name="isVisible" checked class="h-5 w-5 rounded accent-pink-500">
                  <label for="event-visible">Visible to Members</label>
                </div>
                <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Create Event</button>
              </form>
            </div>

            <!-- ADMIN LIST OF MANAGED EVENTS -->
            <h3 class="font-semibold text-lg mb-4">Managed Events</h3>
            <div id="events-list" class="space-y-2">${
              this.state.events
                .map(
                  (event) =>
                    `<div class="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
              <div><p class="font-semibold">${event.name}</p>
              <p class="text-sm text-amber-400">${event.points} Points</p>
              </div><button onclick="app.openEventDetailsModal('${event.id}')" class="text-xs text-pink-400 hover:underline">View Details</button>            
            </div>`
                )
                .join("") ||
              '<p class="text-gray-400 text-center">No events created.</p>'
            }</div></div>
           
          <!-- ADMIN REWARDS CREATION -->
                <div x-show="tab === 'rewards'" style="display: none;">
                <div id="reward-form-panel" class="bg-gray-800 p-4 rounded-lg mb-4">
                    <h3 class="font-semibold text-lg mb-4">${
                      editingReward ? "Edit Reward" : "Add New Reward"
                    }</h3>
                    <form id="reward-form" class="space-y-4" x-data="{ claimType: '${
                      editingReward?.claimType || "once"
                    }', limitType: '${
        editingReward?.claimLimitType || "unlimited"
      }' }">
                        <input name="rewardName" type="text" placeholder="Reward Name" required class="w-full bg-gray-700 rounded-lg p-3" value="${
                          editingReward?.name || ""
                        }">
                        <input name="rewardCost" type="number" placeholder="Point Value" required class="w-full bg-gray-700 rounded-lg p-3" value="${
                          editingReward?.cost || ""
                        }">
                        <select name="rewardType" class="w-full bg-gray-700 rounded-lg p-3">
                            <option value="cost" ${
                              editingReward?.type === "cost" ? "selected" : ""
                            }>Cost (Subtracts Points)</option>
                            <option value="gain" ${
                              editingReward?.type === "gain" ? "selected" : ""
                            }>Gain (Adds Points)</option>
                        </select>
                        <select name="badgeId" class="w-full bg-gray-700 rounded-lg p-3">
                            <option value="">No Badge for this Reward</option>
                            ${this.state.badges
                              .map(
                                (badge) =>
                                  `<option value="${badge.id}" ${
                                    editingReward?.badgeId === badge.id
                                      ? "selected"
                                      : ""
                                  }>${badge.name}</option>`
                              )
                              .join("")}
                        </select>
                        <div><label class="text-sm text-gray-400">Claim Frequency</label><select name="claimType" x-model="claimType" class="w-full bg-gray-700 rounded-lg p-3 mt-1"><option value="once">Once Only</option><option value="daily">Once a Day (Scheduled)</option><option value="scheduled">Specific Dates</option></select></div>
                        <div x-show="claimType === 'daily'" class="bg-gray-900/50 p-3 rounded-lg space-y-2"><label class="text-sm text-gray-400">Active Days</label><div class="grid grid-cols-4 gap-2 text-xs">${[
                          "Sun",
                          "Mon",
                          "Tue",
                          "Wed",
                          "Thu",
                          "Fri",
                          "Sat",
                        ]
                          .map(
                            (day, i) =>
                              `<div><input type="checkbox" name="day_${day.toLowerCase()}" id="day_${i}" value="${i}" ${
                                editingReward?.dailySchedule?.days?.includes(i)
                                  ? "checked"
                                  : ""
                              }> <label for="day_${i}">${day}</label></div>`
                          )
                          .join(
                            ""
                          )}</div><label class="text-sm text-gray-400">Active Time Ranges</label><div id="daily-times-container" class="space-y-2"></div><button type="button" onclick="app.addDailyTimeRow()" class="text-sm text-pink-400 hover:underline">+ Add Time Range</button></div>
                        <div x-show="claimType === 'scheduled'" class="space-y-2"><div id="scheduled-dates-container"></div><button type="button" onclick="app.addScheduleRow()" class="text-sm text-pink-400 hover:underline">+ Add Date/Time</button></div>
                        <div><label class="text-sm text-gray-400">Total Availability</label><select name="claimLimitType" x-model="limitType" class="w-full bg-gray-700 rounded-lg p-3 mt-1"><option value="unlimited">Unlimited</option><option value="limited">Limited</option></select></div>
                        <div x-show="limitType === 'limited'"><input name="claimLimit" type="number" placeholder="Total number of claims" class="w-full bg-gray-700 rounded-lg p-3 mt-1" value="${
                          editingReward?.claimLimit || ""
                        }"></div>
                        <div class="flex items-center space-x-2"><input type="checkbox" id="reward-visible" name="isVisible" ${
                          editingReward
                            ? editingReward.isVisible
                              ? "checked"
                              : ""
                            : "checked"
                        } class="h-5 w-5 rounded accent-pink-500"><label for="reward-visible">Visible to Members</label></div>
                        <div class="flex space-x-2">
                            <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">${
                              editingReward ? "Save Changes" : "Add Reward"
                            }</button>
                            ${
                              editingReward
                                ? `<button type="button" onclick="app.cancelEditRewardMode()" class="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold">Cancel</button>`
                                : ""
                            }
                        </div>
                    </form>
                </div>

               <h3 class="font-semibold text-lg mb-2">Available Rewards</h3>
                <div class="flex space-x-2 mb-4">
                    <input type="search" id="admin-reward-search-input" placeholder="Search rewards..." class="w-full bg-gray-700 rounded-lg p-3">
                    <button onclick="app.handleAdminRewardSearch()" class="pride-gradient-bg px-4 rounded-lg"><i data-lucide="search"></i></button>
                    <button onclick="app.showAllRewards()" class="bg-gray-600 px-4 rounded-lg">Show All</button>
                </div>
            
              <div id="rewards-list" class="space-y-2">${
                filteredRewards
                  .map(
                    (reward) =>
                      `<div class="bg-gray-700 p-3 rounded-lg"><div class="flex items-center justify-between">
                <div>
                <p class="font-semibold">${
                  reward.name
                } <span class="text-xs ml-2 px-2 py-0.5 rounded-full ${
                        reward.isVisible
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-600 text-gray-400"
                      }">${reward.isVisible ? "Visible" : "Hidden"}</span></p>
                <p class="text-sm ${
                  reward.type === "cost" ? "text-red-400" : "text-green-400"
                }">${reward.type === "cost" ? "-" : "+"}${
                        reward.cost
                      } Points</p>
                </div>
              <div class="flex items-center space-x-2">
                <div class="bg-white p-1 rounded-md cursor-pointer" onclick="app.openRewardQrModal('${
                  reward.id
                }')">
                <canvas id="reward-qr-${
                  reward.id
                }" class="reward-qr-canvas" data-reward-id="${
                        reward.id
                      }"></canvas>
                </div>
                <button onclick="app.switchToEditRewardMode('${
                  reward.id
                }'); document.querySelector('[data-tab=rewards]').click();" class="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button onclick="app.handleAdminDeleteReward('${
                  reward.id
                }')" class="p-2 bg-red-900/50 rounded-md hover:bg-red-900/80"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                </div>
              </div>`
                  )
                  .join("") ||
                '<p class="text-gray-400 text-center">No rewards found.</p>'
              }</div>
              </div>
            

      <!-- ADMIN MEMBERS -->
                <div x-show="tab === 'members'" style="display: none;"><div class="bg-gray-800 p-4 rounded-lg mb-4 flex justify-between items-center">
                    <h3 class="font-semibold text-lg">Add New Member</h3>
                    <button onclick="app.openAddMemberModal()" class="pride-gradient-bg text-white font-semibold px-4 py-2 rounded-lg text-sm">Add Account</button></div><h3 class="font-semibold text-lg mb-2">Registered Members</h3><input type="search" oninput="app.handleAdminSearch('member', this.value)" placeholder="Search members by name..." class="w-full bg-gray-700 rounded-lg p-3 mb-4"><div id="members-list" class="space-y-2">${
                      filteredMembers
                        .map(
                          (user) =>
                            `<div class="bg-gray-700 p-3 rounded-lg flex items-center justify-between"><div class="flex items-center space-x-3"><img src="${user.profilePic}" class="w-10 h-10 rounded-full object-cover"><div><p class="font-semibold">${user.firstName} ${user.lastName}</p><p class="text-xs text-gray-400">${user.email}</p></div></div><div class="text-right"><p class="font-bold text-amber-400">${user.points} PTS</p><button onclick="app.openUserEditModal('${user.id}')" class="text-xs text-pink-400 hover:underline">Edit</button></div></div>`
                        )
                        .join("") ||
                      '<p class="text-gray-400 text-center">No members found.</p>'
                    }</div></div><div x-show="tab === 'badges'" style="display: none;"><div class="bg-gray-800 p-4 rounded-lg mb-4"><h3 class="font-semibold text-lg mb-4">Create New Badge</h3><form id="create-badge-form" class="space-y-4"><input name="badgeName" type="text" placeholder="Badge Name" required class="w-full bg-gray-700 rounded-lg p-3"><input name="badgeDescription" type="text" placeholder="Description" required class="w-full bg-gray-700 rounded-lg p-3"><div x-data="{ method: 'select' }"><label class="text-sm text-gray-400">Icon</label><div class="flex space-x-2 p-1 bg-gray-800 rounded-lg my-1"><button type="button" @click="method = 'select'" :class="{ 'pride-gradient-bg text-white': method === 'select', 'bg-gray-700': method !== 'select' }" class="flex-1 py-1 rounded-md text-sm">Select from List</button><button type="button" @click="method = 'text'" :class="{ 'pride-gradient-bg text-white': method === 'text', 'bg-gray-700': method !== 'text' }" class="flex-1 py-1 rounded-md text-sm">Type Name</button><button type="button" @click="method = 'url'" :class="{ 'pride-gradient-bg text-white': method === 'url', 'bg-gray-700': method !== 'url' }" class="flex-1 py-1 rounded-md text-sm">Use URL</button></div><div x-show="method === 'select'"><div class="flex items-center space-x-2"><select name="badgeIconSelect" class="w-full bg-gray-700 rounded-lg p-3">${this.getIconOptions()}</select></div></div><div x-show="method === 'text'" style="display: none;"><input name="badgeIconText" type="text" placeholder="e.g., 'rocket', 'award'" class="w-full bg-gray-700 rounded-lg p-3"></div><div x-show="method === 'url'" style="display: none;"><input name="badgeIconUrl" type="url" placeholder="https://example.com/icon.png" class="w-full bg-gray-700 rounded-lg p-3"></div></div><div x-data="{ criteria: 'special' }"><label class="text-sm text-gray-400">Criteria</label><select name="badgeCriteriaType" @change="criteria = $event.target.value" class="w-full bg-gray-700 rounded-lg p-3 mt-1"><option value="special">Special (Admin Awarded)</option><option value="points">Points Earned</option><option value="events">Events Attended</option></select><div x-show="criteria !== 'special'"><input name="badgeCriteriaValue" type="number" placeholder="Value (e.g., 500)" class="w-full bg-gray-700 rounded-lg p-3 mt-2"></div></div><div class="flex items-center space-x-2"><input type="checkbox" id="badge-visible" name="isVisible" checked class="h-5 w-5 rounded accent-pink-500"><label for="badge-visible">Visible to Members</label></div><button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Create Badge</button></form></div><h3 class="font-semibold text-lg mb-2">Manage Badges</h3><div class="space-y-2">${
        this.state.badges
          .map(
            (badge) =>
              `<div class="bg-gray-700 p-3 rounded-lg flex items-center justify-between"> <div class="flex items-center space-x-3"> ${this.renderBadgeIcon(
                badge.icon,
                "w-8 h-8 text-amber-400"
              )} <div> <p class="font-semibold">${
                badge.name
              }</p> <p class="text-xs text-gray-400">${
                badge.description
              }</p> </div> </div> <div class="flex items-center space-x-2"><button onclick="app.openBadgeEditModal('${
                badge.id
              }')" class="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><i data-lucide="edit-2" class="w-4 h-4"></i></button><button onclick="app.handleDeleteBadge('${
                badge.id
              }')" class="p-2 bg-red-900/50 rounded-md hover:bg-red-900/80"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div> </div>`
          )
          .join("") ||
        '<p class="text-gray-400 text-center">No badges created.</p>'
      }</div></div>
      
      <!-- ADMIN ANNOUNCEMENT -->
      <div x-show="tab === 'announcements'" style="display: none;">
  <!-- ANNOUNCEMENT FORM -->
  <div class="bg-gray-800 p-4 rounded-lg mb-4">
    <h3 id="announcement-form-title" class="font-semibold text-lg mb-4">Post New Announcement</h3>
    <form id="announcement-form" class="space-y-4">
      
      <!-- Hidden input to store the ID of the announcement being edited -->
      <input type="hidden" name="announcementId">
      
      <input type="text" name="announcementTitle" placeholder="Announcement Title" required class="w-full bg-gray-700 rounded-lg p-3">
      <textarea name="announcementMessage" placeholder="Your message here..." required class="w-full bg-gray-700 rounded-lg p-3 h-28"></textarea>
      
      <div class="flex space-x-2">
        <button id="announcement-submit-btn" type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Post Announcement</button>
        
        <!-- Cancel button, hidden by default -->
        <button id="cancel-edit-btn" type="button" onclick="app.handleCancelEdit()" class="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hidden">Cancel</button>
      </div>
    </form>
  </div>
  
      
      <h3 class="font-semibold text-lg mb-2">Recent Announcements</h3>
      <div class="space-y-2">${
        this.state.announcements
          .map(
            (item) =>
              `<div class="bg-gray-700 p-3 rounded-lg">
          <h4 class="font-semibold">${item.title || "No Title"}</h4>
          <p>${item.message}</p> 
          <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-600">
          <p class="text-xs text-gray-400">${item.timestamp}</p> 
          <div class="flex space-x-2">
          <button onclick="app.handleEditClick('${
            item.id
          }')" class="p-1 text-blue-400 hover:bg-blue-900/50 rounded-md"> <i data-lucide="pencil" class="w-4 h-4"></i> </button>
          <button onclick="app.handleDeleteAnnouncement('${
            item.id
          }')" class="p-1 text-red-400 hover:bg-red-900/50 rounded-md"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
         </div>
        </div>
      </div>`
          )
          .join("") ||
        '<p class="text-gray-400 text-center">No announcements yet.</p>'
      }</div></div>


 
      
      <!-- ADMIN SCAN QR CODE -->
      <div x-show="tab === 'scan'" style="display: none;">
      <h3 class="font-semibold text-lg mb-2">Award via QR Scan</h3>
        <div class="space-y-4 bg-gray-700 p-4 rounded-lg">
        <p class="text-sm text-gray-300">Select a reward or badge to give to the member upon scanning their QR code.</p>
          <div>
          <label for="admin-reward-select" class="block text-sm font-medium text-gray-300 mb-1">Select Reward</label>
          <select id="admin-reward-select" class="w-full bg-gray-800 rounded-lg p-3 outline-none">
          <option value="">-- No Reward --</option>${this.state.adminRewards
            .map(
              (r) =>
                `<option value="${r.id}" data-points="${r.cost}">${r.name} (${
                  r.type === "gain" ? "+" : "-"
                }${r.cost} pts) ${r.isVisible ? "" : "🚫"}</option>`
            )
            .join("")}
          </select>
          </div>
      <div>

                                
    <label class="block text-sm font-medium text-gray-300 mb-1">Select Badge</label>
    <!-- This is a hidden input to store the ID of the selected badge -->
    <input type="hidden" id="admin-badge-select-hidden" value="">
    <!-- This is our new button and preview area -->
    <button type="button" onclick="app.openAdminBadgeSelector()" id="admin-badge-selector-preview" class="w-full bg-gray-800 rounded-lg p-3 flex items-center justify-between text-left">
        <span class="text-gray-400">-- No Badge --</span>
        <i data-lucide="chevron-down"></i>
    </button>
</div>

<div id="admin-qr-reader" class="w-full rounded-lg overflow-hidden"></div>
<p id="admin-scan-status" class="text-center text-yellow-400 h-4"></p>
<button id="start-scan-btn" onclick="app.startAdminScanner()" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"><i data-lucide="camera"></i><span>Start Scan</span></button>
</div>

<!--ADMIN LOGS-->
</div><div x-show="tab === 'logs'" style="display: none;">
<h3 class="font-semibold text-lg mb-4 text-center">System Activity Logs</h3>
  <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
    <select id="log-year-select" class="bg-gray-700 rounded-lg p-2 text-sm"><option value="all" ${
      this.state.logFilter.year === "all" ? "selected" : ""
    }>All Years</option>${[
        ...new Set(
          this.state.systemLogs.map((l) => l.timestamp.toDate().getFullYear())
        ),
      ]
        .sort((a, b) => b - a)
        .map(
          (year) =>
            `<option value="${year}" ${
              this.state.logFilter.year == year ? "selected" : ""
            }>${year}</option>`
        )
        .join(
          ""
        )}</select><select id="log-month-select" class="bg-gray-700 rounded-lg p-2 text-sm"><option value="all" ${
        this.state.logFilter.month === "all" ? "selected" : ""
      }>All Months</option>${Array.from(
        { length: 12 },
        (_, i) =>
          `<option value="${i + 1}" ${
            this.state.logFilter.month == i + 1 ? "selected" : ""
          }>${new Date(0, i).toLocaleString("default", {
            month: "long",
          })}</option>`
      ).join(
        ""
      )}</select><select id="log-day-select" class="bg-gray-700 rounded-lg p-2 text-sm"><option value="all" ${
        this.state.logFilter.day === "all" ? "selected" : ""
      }>All Days</option>${Array.from(
        { length: 31 },
        (_, i) =>
          `<option value="${i + 1}" ${
            this.state.logFilter.day == i + 1 ? "selected" : ""
          }>${i + 1}</option>`
      ).join("")}
      </select>
      <button onclick="app.applyLogFilter()" class="pride-gradient-bg text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center justify-center space-x-2"><i data-lucide="search" class="w-4 h-4"></i><span>Search</span></button>
      </div>
      
      <div class="space-y-2">${
        filteredLogs
          .map(
            (log) =>
              `<div class="bg-gray-700 p-3 rounded-lg text-sm"><p><strong class="text-amber-400">${
                log.actorName || "System"
              }</strong> ${log.details}</p>
                ${
                  log.beforePoints !== undefined
                    ? `<p class="text-xs text-gray-400">Points: ${log.beforePoints} → ${log.afterPoints}</p>`
                    : ""
                }<p class="text-xs text-gray-400 mt-1">${log.timestamp
                .toDate()
                .toLocaleString()}</p>
              </div>`
          )
          .join("") ||
        '<p class="text-gray-400 text-center py-4">No logs match the current filter.</p>'
      }</div></div>
      
            
      </div>`;
    },
  };


//FETCH ANNOUNCEMENT
this.fetchAnnouncements = async () => {
  try {
    const { getFirestore, collection, query, getDocs, orderBy } = this.fb;
    const db = getFirestore();
    const announcementsRef = collection(db, "announcements");
    // Order by timestamp to show the newest announcements first
    const q = query(announcementsRef, orderBy("timestamp", "desc"));

    const querySnapshot = await getDocs(q);
    const announcementsData = [];
    querySnapshot.forEach((doc) => {
      announcementsData.push({ id: doc.id, ...doc.data() });
    });

    this.state.announcements = announcementsData;
    console.log("Announcements loaded successfully.");
  } catch (error) {
    console.error("Error fetching announcements:", error);
  }
};

/**
 * Toggles the expanded state of an announcement item.
 */
this.toggleAnnouncement = (element) => {
    element.classList.toggle('expanded');
};

this.showTermsModal = () => {
    const content = `
      <div class="text-left text-gray-300 space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-2">
          <p class="font-bold">Last Updated: September 17, 2025</p>
          
          <p>Welcome to Pride Pass! These terms and conditions outline the rules and regulations for the use of the Pride Pass application, a project developed by the BBGS President.</p>
          <p>By accessing and using this app, you accept these terms and conditions in full. Do not continue to use Pride Pass if you do not accept all of the terms and conditions stated on this page.</p>
          
          <div>
              <h4 class="font-bold text-white mb-2">1. Accounts and Registration</h4>
              <ul class="list-disc list-inside space-y-2">
                <li>To use most features of Pride Pass, you must register for an account. You must provide accurate and complete information and keep your account information updated.</li>
                <li>You are responsible for maintaining the confidentiality of your account and password and for restricting access to your device. You agree to accept responsibility for all activities that occur under your account.</li>
                <li>You must be at least 13 years of age to use this app.</li>
              </ul>
          </div>
          
          <div>
              <h4 class="font-bold text-white mb-2">2. User Conduct</h4>
              <ul class="list-disc list-inside space-y-2">
                <li>You agree to use Pride Pass only for lawful purposes and in a way that does not infringe the rights of, restrict, or inhibit anyone else's use and enjoyment of the app.</li>
                <li>Prohibited behavior includes harassing or causing distress or inconvenience to any other user, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within the app.</li>
                <li>Hate speech, discriminatory remarks, and any form of bullying are strictly prohibited and will result in immediate account termination.</li>
              </ul>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">3. User-Generated Content</h4>
              <ul class="list-disc list-inside space-y-2">
                  <li>You are solely responsible for your profile information, photos, chat messages, and any other content you submit to the app ("User Content").</li>
                  <li>By submitting User Content, you grant us a non-exclusive, royalty-free license to use, reproduce, and display such content in connection with the app's services.</li>
                  <li>You agree not to post any content that is illegal, defamatory, or infringes on any third-party rights. We reserve the right to remove any content that violates these terms.</li>
              </ul>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">4. Points and Rewards System</h4>
              <ul class="list-disc list-inside space-y-2">
                  <li>The points, badges, and rewards system within Pride Pass is provided for engagement and entertainment purposes.</li>
                  <li>Points and rewards have no cash value and cannot be redeemed for cash or transferred outside of the app.</li>
                  <li>We reserve the right to modify, suspend, or terminate any aspect of the rewards system at any time without notice.</li>
              </ul>
          </div>

           <div>
              <h4 class="font-bold text-white mb-2">5. Privacy</h4>
              <p>Your privacy is important to us. Our Privacy Policy, which is a separate document, explains how we collect, use, and protect your personal information. By using this app, you agree to the collection and use of information in accordance with our Privacy Policy.</p>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">6. Termination</h4>
              <ul class="list-disc list-inside space-y-2">
                  <li>We may terminate or suspend your access to our app immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</li>
                  <li>You may terminate your account at any time by contacting the app administrators.</li>
              </ul>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">7. Disclaimers and Limitation of Liability</h4>
              <ul class="list-disc list-inside space-y-2">
                  <li>The app is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, expressed or implied, regarding the operation or availability of the app.</li>
                  <li>The app may contain bugs or errors. We are not liable for any damages that may arise from the use of this app.</li>
              </ul>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">8. Governing Law</h4>
              <p>These terms will be governed by and construed in accordance with the laws of the Republic of the Philippines, and you submit to the non-exclusive jurisdiction of the courts located in Cebu City for the resolution of any disputes.</p>
          </div>

          <div>
              <h4 class="font-bold text-white mb-2">9. Contact Us</h4>
              <p>If you have any questions about these Terms, please contact us at bbgsofficial2021@gmail.com | +639666517133</p>
          </div>
      </div>
    `;
    this.openFullscreenModal('Terms and Conditions', content);
};



  // --- FIREBASE INITIALIZATION ---
  this.init = async () => {
    // Your web app's Firebase configuration
  

    const firebaseConfig = {
  apiKey: "AIzaSyBqEzwtvtr-5XEdMqDZV16Sk99YTV44Xbk",
  authDomain: "costing-a3c19.firebaseapp.com",
  projectId: "costing-a3c19",
  storageBucket: "costing-a3c19.firebasestorage.app",
  messagingSenderId: "552775279399",
  appId: "1:552775279399:web:49324bdb32dfab87233f02",
      measurementId: "G-P5RG5129KZ",
  databaseURL: "https://qrcode-7f9c0-default-rtdb.firebaseio.com",
};

    try {
      this.fb.app = initializeApp(firebaseConfig);
      // ... your other Firebase service initializations (auth, db, etc.) ...
      this.manageWakeLock();
      
       if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');

        // Check for iOS/Safari and show the manual instructions button
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // Also check if the app is NOT already running in standalone (installed) mode
        const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
        
        if (isIOS && !isInStandaloneMode) {
            // Use a timeout to ensure the DOM has rendered the button
            setTimeout(() => {
                const iosInstallButton = document.getElementById('ios-install-button');
                if(iosInstallButton) iosInstallButton.style.display = 'flex';
            }, 500);
        }
      }

      // Listen for the standard PWA install prompt (for Chrome/Android)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredInstallPrompt = e;
        const installButton = document.getElementById('install-app-button');
        if (installButton) {
          installButton.style.display = 'flex'; // Make the button visible
        }
      });


    } catch (error) {}

    try {
      this.fb.app = initializeApp(firebaseConfig);
      this.fb.auth = getAuth(this.fb.app);
      this.fb.db = getFirestore(this.fb.app);
      this.fb.rtdb = getDatabase(this.fb.app);
      this.fb.storage = getStorage(this.fb.app);
      this.manageWakeLock();
       
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      this.elements.loadingText.textContent =
        "Connection failed. Please refresh.";
      this.elements.loadingText.classList.add("text-red-400");
      return;
    }



    await this.handleRedirectResult();

    onAuthStateChanged(this.fb.auth, async (user) => {
      this.detachListeners(); // Clear old listeners on auth state change
      if (user && !user.isAnonymous) {
        this.state.firebaseUser = user;
        const userDoc = await getDoc(
          doc(this.fb.db, this.paths.userDoc(user.uid))
        );
        if (userDoc.exists()) {
          
          this.state.loggedInUser = { id: user.uid, ...userDoc.data() };
          await this.fetchAnnouncements(); 
          this.elements.appHeader.classList.remove("hidden");
          this.elements.appNav.classList.remove("hidden");
          this.applyTheme(this.state.loggedInUser.theme);
          this.managePresence();
          this.attachListeners(); // Attach all necessary listeners for the logged-in user
          this.updateUserInfo();
          this.navigateTo("dashboard");
        } 
        
        
        else {
          // User exists in Auth, but not in Firestore database. Log them out.
          this.handleLogout();
        }
      } else {
        this.state.firebaseUser = null;
        this.state.loggedInUser = null;
        this.state.announcements = []; 
        this.elements.appHeader.classList.add("hidden");
        this.elements.appNav.classList.add("hidden");
        this.applyTheme("default");
        this.navigateTo("auth");
      }
      this.elements.loadingOverlay.classList.add("hidden");
    });

    
  
  };

 this.handleInstallClick = async () => {
    if (this.deferredInstallPrompt) {
      this.deferredInstallPrompt.prompt();
      const { outcome } = await this.deferredInstallPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      this.deferredInstallPrompt = null;
      const installButton = document.getElementById('install-app-button');
      if (installButton) installButton.style.display = 'none';
    }
  };

  this.showIosInstallInstructions = () => {
      const content = `
        <div class="text-left space-y-4">
            <p class="font-semibold text-lg">To Add to Home Screen:</p>
            <ol class="list-decimal list-inside space-y-4 text-gray-300">
                <li>Tap the <i data-lucide="share" class="inline-block w-5 h-5 mx-1"></i> <span class="font-semibold">Share</span> button in Safari.</li>
                <li>Scroll down and tap <i data-lucide="plus-square" class="inline-block w-5 h-5 mx-1"></i> <span class="font-semibold">"Add to Home Screen"</span>.</li>
            </ol>
            <img src="IOSguide.png" alt="Visual instructions for adding an app to the home screen on iOS" class="rounded-lg mt-4 border border-gray-600">
        </div>
      `;
      this.openFullscreenModal('Install App on iOS', content);
  };

   
  // --- NEW FUNCTION: MANAGE PRESENCE ---
  this.managePresence = () => {
    if (!this.state.firebaseUser) return;

    const myUid = this.state.firebaseUser.uid;
    const userStatusDatabaseRef = ref(this.fb.rtdb, `/status/${myUid}`);
    const userStatusFirestoreRef = doc(this.fb.db, this.paths.userDoc(myUid));

    const isOfflineForRTDB = {
      state: "offline",
      last_changed: serverTimestamp(),
    };

    const isOnlineForRTDB = {
      state: "online",
      last_changed: serverTimestamp(),
    };

    const isOfflineForFirestore = {
      online: false,
      lastSeen: firestoreServerTimestamp(),
    };

    const isOnlineForFirestore = {
      online: true,
      lastSeen: firestoreServerTimestamp(),
    };

    // Listen for connection status to RTDB
    onValue(ref(this.fb.rtdb, ".info/connected"), (snapshot) => {
      if (snapshot.val() === false) {
        // If connection is lost, update firestore
        updateDoc(userStatusFirestoreRef, isOfflineForFirestore);
        return;
      }

      // If connection is established, set up onDisconnect hooks
      onDisconnect(userStatusDatabaseRef)
        .set(isOfflineForRTDB)
        .then(() => {
          set(userStatusDatabaseRef, isOnlineForRTDB);
          updateDoc(userStatusFirestoreRef, isOnlineForFirestore);
        });
    });
  };

  // --- REAL-TIME LISTENERS ---
  this.attachListeners = () => {
    // Listeners for data specific to the logged-in user

    const userListener = onSnapshot(
      doc(this.fb.db, this.paths.userDoc(this.state.firebaseUser.uid)),
      (doc) => {
        this.state.loggedInUser = { id: doc.id, ...doc.data() };
        this.updateUserInfo();
        this.applyTheme(this.state.loggedInUser.theme);
        if (this.state.currentPage === "profile") this.render();
      }
    );
    this.state.listeners.push(userListener);

    const logsListener = onSnapshot(
      query(
        collection(
          this.fb.db,
          this.paths.pointLogs(this.state.firebaseUser.uid)
        )
      ),
      (snapshot) => {
        this.state.pointLogs = snapshot.docs.map((doc) => doc.data());
      }
    );
    this.state.listeners.push(logsListener);

    const rsvpListener = onSnapshot(
      query(
        collection(this.fb.db, this.paths.rsvps(this.state.firebaseUser.uid))
      ),
      (snapshot) => {
        this.state.rsvps = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (this.state.currentPage === "events") this.render();
      }
    );
    this.state.listeners.push(rsvpListener);

    const earnedBadgesListener = onSnapshot(
      query(
        collection(
          this.fb.db,
          this.paths.earnedBadges(this.state.firebaseUser.uid)
        )
      ),
      (snapshot) => {
        this.state.earnedBadges = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (this.state.currentPage === "profile") this.render();
      }
    );
    this.state.listeners.push(earnedBadgesListener);

    // Listeners for public/shared data
    const eventsListener = onSnapshot(
      query(collection(this.fb.db, this.paths.events)),
      (snapshot) => {
        this.state.events = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (["admin", "events"].includes(this.state.currentPage)) this.render();
      }
    );
    this.state.listeners.push(eventsListener);

    const allUsersListener = onSnapshot(
      query(collection(this.fb.db, this.paths.users)),
      (snapshot) => {
        this.state.users = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (
          ["admin", "directory", "leaderboard"].includes(this.state.currentPage)
        )
          this.render();
      }
    );
    this.state.listeners.push(allUsersListener);

    const announcementsListener = onSnapshot(
      query(collection(this.fb.db, this.paths.announcements)),
      (snapshot) => {
        this.state.announcements = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (["admin", "dashboard"].includes(this.state.currentPage))
          this.render();
      }
    );
    this.state.listeners.push(announcementsListener);

    const badgesListener = onSnapshot(
      query(collection(this.fb.db, this.paths.badges)),
      (snapshot) => {
        this.state.badges = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        if (
          ["admin", "profile", "badges", "scan"].includes(
            this.state.currentPage
          )
        )
          this.render();
      }
    );
    this.state.listeners.push(badgesListener);
    this.listenToUsers();

    const mapSpotsListener = onSnapshot(
      query(collection(this.fb.db, this.paths.mapSpots)),
      (snapshot) => {
        this.state.mapSpots = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Re-render if the user is on a page that uses this data
        if (["qrSpots", "admin"].includes(this.state.currentPage)) {
          this.render();
        }
      }
    );
    this.state.listeners.push(mapSpotsListener);

    // New listener for system logs (only for admin)
    if (this.state.loggedInUser.email === this.state.adminEmail) {
      const systemLogsListener = onSnapshot(
        query(
          collection(this.fb.db, this.paths.systemLogs),
          orderBy("timestamp", "desc")
        ),
        (snapshot) => {
          this.state.systemLogs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          if (this.state.currentPage === "admin") this.render();
        }
      );

      this.state.listeners.push(systemLogsListener);
    }

    this.listenToUserChats();
  };

  this.detachListeners = () => {
    this.state.listeners.forEach((unsubscribe) => unsubscribe());
    this.state.listeners = [];

    this.detachChatListeners();
  };


//THIS RENDER MAIN
  this.render = () => {
    const template = this.templates[this.state.currentPage];
    if (template) {
      this.elements.mainContent.innerHTML = template();
      this.postRender();
    }
  };

  this.navigateTo = (page) => {
    // Remove any existing scroll listener from the previous page
    this.elements.mainContent.onscroll = null;
       if (this.state.currentPage === "scanner" && this.qrScanner)
      this.stopScanner();
    if (
      this.state.loggedInUser &&
      !this.state.loggedInUser.isValidated &&
      ["scanner", "directory", "leaderboard", "rewards", "badges"].includes(
        page
      )
    ) {
      return this.showModal(
        "info",
        "Account Pending",
        "This feature is available after your account is approved by an admin."
      );
    }

    if (page === "admin") {
      this.fetchAllRewardsForAdmin();
    }

  this.state.currentPage = page;
    if (page === "rewards") {
      this.state.rewards = [];
      this.state.rewardsLastDoc = null;
      this.state.rewardsAllLoaded = false;
      this.fetchRewards(); // Fetch the first batch
    }

    // If navigating to the leaderboard, reset its display count
    if (page === "leaderboard") {
      this.state.leaderboardDisplayCount = 10;
      this.state.leaderboardLoading = false; // Reset the loading flag
    }
    if (this.aboutAudio) {
        this.aboutAudio.pause();
        this.aboutAudio.currentTime = 0;
        this.aboutAudio = null;
      }
    if (page === 'about') {  
      this.aboutAudio = new Audio("NoteGPT_Speech_1757811715642.mp3");
      this.aboutAudio.play();
    }

      

    this.updateNav();
    this.state.currentPage = page;
    this.render();
  };

  

  // 5minutes Online
  this.isUserOnline = (timestamp) => {
    if (!timestamp) return false;
    const lastSeenTime = timestamp.toDate();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeenTime > fiveMinutesAgo;
  };

  this.updateNav = () => {
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.classList.remove("pride-gradient-text");
      btn.classList.add("text-gray-400");
    });
    const activeBtn = document.querySelector(
      `.nav-button[onclick="app.navigateTo('${this.state.currentPage}')"]`
    );
    if (activeBtn) {
      activeBtn.classList.add("pride-gradient-text");
      activeBtn.classList.remove("text-gray-400");
    }
  };

  this.postRender = () => {
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
    if (window.Alpine) {
      window.Alpine.discoverUninitializedComponents((el) =>
        window.Alpine.initializeComponent(el)
      );
    }
    switch (this.state.currentPage) {
      case "messages":
        // Find the container for messages
        const messagesContainer = document.getElementById("messages-container");

        if (messagesContainer) {
          // **THIS IS THE FIX**: Set the scroll position to the very bottom
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Note: It's often better to use onsubmit="app.sendMessage(event)" in your HTML template
        // rather than adding this listener here, to avoid attaching it multiple times.
        // If your form in the render function already has that, you can remove the code below.

        if (this.state.currentChatId) {
          const chatInputForm = document.getElementById("chat-input-form"); // Ensure your form has this ID
          if (chatInputForm) {
            chatInputForm.onsubmit = (e) => {
              e.preventDefault();
              this.sendMessage(e);
            };
          }
        }
        break;
      case "dashboard":
        
        if (this.state.loggedInUser.isValidated)
          this.generateQRCode(
            "member-qr-code",
            JSON.stringify({ type: "member", id: this.state.loggedInUser.id }),
            80
          );
        break;
      case "qrSpots":
        this.initUserMap();
        break;
      case "facebookFeed":
        if (typeof FB !== "undefined") {
          FB.XFBML.parse();
        }
        break;
      case "leaderboard":
        const mainEl = this.elements.mainContent;
        mainEl.onscroll = () => {
          const rankedUsers = this.state.users.filter((u) => u.isValidated);
          // If we are already loading or all items are shown, do nothing.
          if (
            this.state.leaderboardLoading ||
            this.state.leaderboardDisplayCount >= rankedUsers.length
          ) {
            return;
          }

          // Check if user is near the bottom (150px threshold)
          if (
            mainEl.scrollTop + mainEl.clientHeight >=
            mainEl.scrollHeight - 150
          ) {
            this.state.leaderboardLoading = true; // Set loading flag to true
            this.render(); // Re-render to show the spinner

            // Use a short delay to load the next batch
            setTimeout(() => {
              this.state.leaderboardDisplayCount += 10; // Increase the number of users to show
              this.state.leaderboardLoading = false; // Reset the flag
              this.render(); // Re-render with the new items
            }, 500);
          }
        };
        break;
      case "profile":

      const user = this.state.loggedInUser;
        const form = document.getElementById("profile-form");

        if (user && form) {
            // An array of the dropdown names we need to set
            const fieldsToSet = ['pronouns', 'gender', 'orientation'];

            fieldsToSet.forEach(field => {
                const selectElement = form.elements[field];
                if (selectElement) {
                    // This correctly sets the dropdown to the user's saved value
                    selectElement.value = user[field] || '';
                }
            });
        }

        document
          .getElementById("profile-form")
          .addEventListener("submit", this.handleProfileUpdate.bind(this));
        document
          .getElementById("profile-pic-upload")
          .addEventListener("change", this.handleProfilePicChange.bind(this));
        break;
      case "scanner":
        this.startScanner();
        break;
      case "admin":
               if (document.getElementById("reward-form")) {
          document
            .getElementById("reward-form")
            .addEventListener("submit", (e) => {
              e.preventDefault();
              if (this.state.adminEditingRewardId) {
                this.handleAdminUpdateReward(e);
              } else {
                this.handleCreateReward(e);
              }
            });
        }
        if (this.state.adminEditingRewardId) {
          const reward = this.state.rewards.find(
            (r) => r.id === this.state.adminEditingRewardId
          );
          if (reward?.claimType === "daily" && reward.dailySchedule?.times) {
            reward.dailySchedule.times.forEach((time) =>
              this.addDailyTimeRow(time.start, time.end)
            );
          }
          if (reward?.claimType === "scheduled" && reward.schedules) {
            reward.schedules.forEach((schedule) => {
              const [date, start] = schedule.startDate.split("T");
              const [, end] = schedule.endDate.split("T");
              this.addScheduleRow(date, start, end);
            });
          }
        }
        if (document.getElementById("create-event-form"))
          document
            .getElementById("create-event-form")
            .addEventListener("submit", this.handleCreateEvent.bind(this));
        if (document.getElementById("create-announcement-form"))
          document
            .getElementById("create-announcement-form")
            .addEventListener(
              "submit",
              this.handleCreateAnnouncement.bind(this)
            );
        if (document.getElementById("create-badge-form"))
          document
            .getElementById("create-badge-form")
            .addEventListener("submit", this.handleCreateBadge.bind(this));
        document.querySelectorAll(".reward-qr-canvas").forEach((canvas) => {
          const rewardId = canvas.dataset.rewardId;
          if (rewardId) {
            this.generateQRCode(
              canvas.id,
              JSON.stringify({ type: "reward", id: rewardId }),
              48
            );
          }
        });
        break;
      case "userguide":
          html = this.views.userguide();
          break;
    }
  };

 

  this.eventIcon = L.icon({
    iconUrl:
      "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2x5MDR4dzVkYmo3OThhdTc3Z2F6Njhsc3k0dGhvN2t4em11d25haCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/EOIQArrlGT8SeIvYma/giphy.gif", // Example icon URL for events
    iconSize: [38, 38], // Size of the icon
    iconAnchor: [19, 38], // Point of the icon which will correspond to marker's location
    popupAnchor: [0, -42], // Point from which the popup should open relative to the iconAnchor
  });

  this.rewardIcon = L.icon({
    iconUrl:
      "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGZhcHV1ZDhkbXducXp4cGQ0dHl3ZGhrc2tubzhmMDdsanBnbGdsMSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/30b4QdhJGC3OYuepgu/giphy.gif", // Example icon URL for rewards
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -42],
  });

  // --- MAP ---
  this.initUserMap = () => {
    const mapElement = document.getElementById("user-map");
    if (!mapElement || mapElement._leaflet_id) return; // Prevent re-initialization

    // Initialize the map
    this.map = L.map("user-map").setView([11.5833, 124.4333], 13); // Store map in this.map

    // Add the tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    // --- START: Geolocation Code for User's Current Location ---
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLatLng = [
            position.coords.latitude,
            position.coords.longitude,
          ];

          // Add a marker for user's location
          const userMarker = L.marker(userLatLng, {
            icon: L.icon({
              iconUrl:
                "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2VoNml6NTdmZmZ6M2tuczhld3F0bm8zaW5tOGtjYWMyZDRyams5bCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/GzsIjuVuxRR8cXL7Cw/giphy.gif", // or your preferred icon
              iconSize: [38, 38],
              iconAnchor: [19, 38],
              popupAnchor: [1, -10],
            }),
            title: "Your Location",
          }).addTo(this.map);

          userMarker.bindPopup("You are here").openPopup();

          // Optionally, center the map on user's location
          this.map.setView(userLatLng, 13);
        },
        (error) => {
          console.warn(`Geolocation error: ${error.message}`);
          // You can optionally display a message to the user if geolocation fails
          // e.g., this.showModal('info', 'Location Unavailable', 'Could not get your current location.');
        }
      );
    } else {
      console.warn("Geolocation is not supported by this browser.");
      // You can optionally display a message to the user if geolocation is not supported
      // e.g., this.showModal('info', 'Browser Limitation', 'Geolocation is not supported by your browser.');
    }
    // --- END: Geolocation Code ---

    // Add markers for each spot (your existing code for QR spots)
    this.state.mapSpots.forEach((spot) => {
      let popupContent = "<strong>QR Spot</strong><br>Unknown Type";
      let customIcon;
      const item = this.getItemForSpot(spot);

      if (item) {
        popupContent = `<strong>${
          item.name
        }</strong><br><span class="text-xs">${
          spot.spotType.charAt(0).toUpperCase() + spot.spotType.slice(1)
        } Spot</span>`;
      }

      switch (spot.spotType) {
        case "event":
          customIcon = this.eventIcon;
          break;
        case "reward": // Changed from 'rewards' to 'reward' to match your data structure
          customIcon = this.rewardIcon;
          break;
        case "badge":
          const badge = this.getItemForSpot(spot);
          if (badge && badge.icon.startsWith("http")) {
            customIcon = L.icon({
              iconUrl: badge.icon,
              iconSize: [38, 38],
              iconAnchor: [19, 38],
              popupAnchor: [0, -42],
            });
          } else {
            // Fallback icon if the badge icon is not a URL
            customIcon = L.icon({
              iconUrl:
                "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWh6MWo0b2F3azc3NXBsM2xzMDhycXdoNTZ5YXRtNHR3eHhydzltNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/AD8kBgyVlNBcoxuVSm/giphy.gif", // Default badge icon
              iconSize: [38, 38],
              iconAnchor: [19, 38],
              popupAnchor: [0, -42],
            });
          }
          break;
        default:
          // A default icon for any other spot types
          customIcon = L.icon({
            iconUrl: "https://img.icons8.com/ios-filled/50/000000/marker.png",
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -34],
          });
      }

      L.marker([spot.lat, spot.lng], {
        icon: customIcon,
      })
        .addTo(this.map) // Use this.map here
        .bindPopup(popupContent);
    });

    // Invalidate map size after a short delay to ensure it renders correctly
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);
  };

  this.getItemForSpot = (spot) => {
    if (spot.spotType === "event") {
      return this.state.events.find((e) => e.id === spot.linkedId);
    } else if (spot.spotType === "reward") {
      return this.state.rewards.find((r) => r.id === spot.linkedId);
    } else if (spot.spotType === "badge") {
      return this.state.badges.find((b) => b.id === spot.linkedId);
    }
    return null;
  };

  this.initAdminMap = () => {
    const mapElement = document.getElementById("admin-map");
    if (!mapElement || mapElement._leaflet_id) return;

    // Store the map instance
    this.map = L.map("admin-map").setView([11.5833, 124.4333], 13); // Store map in this.map
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      this.map
    ); // Use this.map
    // Show user's current location on the map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLatLng = [
            position.coords.latitude,
            position.coords.longitude,
          ];

          // Add a marker for user's location
          const userMarker = L.marker(userLatLng, {
            icon: L.icon({
              iconUrl:
                "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExa292bXkzb29saGRiNXp4OHhnbmI5cjVncndxZTVnbWRiM2RtMDQ1NCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/NR7gG7kTotB0SbZHx2/giphy.gif", // example icon URL, you can replace with your own
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -36],
            }),
            title: "Your Location",
          }).addTo(this.map);

          userMarker.bindPopup("You are here").openPopup();

          // Optionally, center the map on user's location
          this.map.setView(userLatLng, 13);
        },
        (error) => {
          console.warn(`Geolocation error: ${error.message}`);
          // You can optionally handle errors here
        }
      );
    } else {
      console.warn("Geolocation is not supported by this browser.");
    }

    let newSpotMarker;
    this.map.on("click", (e) => {
      // Use this.map
      const { lat, lng } = e.latlng;

      // Determine which form is active (add or edit)
      const addForm = document.getElementById("add-spot-form");
      const editForm = document.getElementById("edit-spot-form");

      if (addForm.style.display !== "none") {
        // Add form is visible
        document.querySelector('#add-spot-form input[name="spotLat"]').value =
          lat;
        document.querySelector('#add-spot-form input[name="spotLng"]').value =
          lng;
        document.getElementById("coords-display").textContent = `${lat.toFixed(
          6
        )}, ${lng.toFixed(6)}`;

        if (newSpotMarker) {
          newSpotMarker.setLatLng(e.latlng);
        } else {
          newSpotMarker = L.marker(e.latlng, { draggable: true }).addTo(
            this.map
          );
          newSpotMarker.on("dragend", (event) => {
            const marker = event.target;
            const position = marker.getLatLng();
            document.querySelector(
              '#add-spot-form input[name="spotLat"]'
            ).value = position.lat;
            document.querySelector(
              '#add-spot-form input[name="spotLng"]'
            ).value = position.lng;
            document.getElementById(
              "coords-display"
            ).textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(
              6
            )}`;
          });
        }
      } else if (editForm.style.display !== "none") {
        // Edit form is visible
        document.querySelector(
          '#edit-spot-form input[name="editSpotLat"]'
        ).value = lat;
        document.querySelector(
          '#edit-spot-form input[name="editSpotLng"]'
        ).value = lng;
        document.getElementById(
          "edit-coords-display"
        ).textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

        if (this.currentEditMarker) {
          this.currentEditMarker.setLatLng(e.latlng);
        } else {
          this.currentEditMarker = L.marker(e.latlng, {
            draggable: true,
          }).addTo(this.map);
          this.currentEditMarker.on("dragend", (event) => {
            const marker = event.target;
            const position = marker.getLatLng();
            document.querySelector(
              '#edit-spot-form input[name="editSpotLat"]'
            ).value = position.lat;
            document.querySelector(
              '#edit-spot-form input[name="editSpotLng"]'
            ).value = position.lng;
            document.getElementById(
              "edit-coords-display"
            ).textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(
              6
            )}`;
          });
        }
      }
    });

    // Also display existing spots
    this.state.mapSpots.forEach((spot) => {
      const marker = L.marker([spot.lat, spot.lng]).addTo(this.map); // Use this.map
      marker.on("click", () => {
        this.editSpot(spot.id);
      });
    });

    // Invalidate map size after a short delay to ensure it renders correctly
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);
  };

  this.populateAdminSpotForm = (isEditMode = false, currentLinkedId = null) => {
    const typeSelect = document.querySelector(
      isEditMode
        ? '#edit-spot-form select[name="editSpotType"]'
        : '#add-spot-form select[name="spotType"]'
    );
    const itemSelect = document.querySelector(
      isEditMode
        ? '#edit-spot-form select[name="editLinkedId"]'
        : '#add-spot-form select[name="linkedId"]'
    );
    if (!typeSelect || !itemSelect) return;

    const selectedType = typeSelect.value;
    let options = "";

    if (selectedType === "event") {
      this.state.events.forEach(
        (item) =>
          (options += `<option value="${item.id}" ${
            item.id === currentLinkedId ? "selected" : ""
          }>${item.name}</option>`)
      );
    } else if (selectedType === "reward") {
      this.state.adminRewards.forEach(
        // Use adminRewards for rewards
        (item) =>
          (options += `<option value="${item.id}" ${
            item.id === currentLinkedId ? "selected" : ""
          }>${item.name}</option>`)
      );
    } else if (selectedType === "badge") {
      this.state.badges.forEach(
        (item) =>
          (options += `<option value="${item.id}" ${
            item.id === currentLinkedId ? "selected" : ""
          }>${item.name}</option>`)
      );
    }
    itemSelect.innerHTML = options;
  };

  this.populateSpotsList = () => {
    const listElement = document.getElementById("spots-list");
    if (!listElement) return;

    listElement.innerHTML = this.state.mapSpots
      .map((spot) => {
        const item = this.getItemForSpot(spot);
        return `
                <div class="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                    <div>
                        <p class="font-semibold">${
                          item ? item.name : "Linked item not found"
                        }</p>
                        <p class="text-xs text-gray-400">${
                          spot.spotType.charAt(0).toUpperCase() +
                          spot.spotType.slice(1)
                        } Spot</p>
                        <p class="text-xs text-gray-400">${
                          spot.description || "No description"
                        }</p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="app.editSpot('${
                          spot.id
                        }')" class="p-2 bg-gray-600 rounded-md hover:bg-gray-500"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button onclick="app.handleDeleteSpot('${
                          spot.id
                        }')" class="p-2 bg-red-500/20 text-red-400 rounded-md"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            `;
      })
      .join("");
    lucide.createIcons();
  };


  this.handleSaveSpot = async (e) => {
    e.preventDefault();
    const form = e.target;
    const lat = form.elements.spotLat.value;
    const lng = form.elements.spotLng.value;
    const spotType = form.elements.spotType.value;
    const linkedId = form.elements.linkedId.value;
    const description = form.elements.spotDescription.value; // ADD THIS LINE

    if (!lat || !lng) {
      return this.showModal(
        "error",
        "Location Missing",
        "Please click on the map to select a location for the spot."
      );
    }

    try {
      await addDoc(collection(this.fb.db, this.paths.mapSpots), {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        spotType,
        linkedId,
        description, // ADD THIS LINE
      });
      this.showModal(
        "success",
        "Spot Saved!",
        "The new QR spot has been added to the map."
      );
      form.reset();
      document.getElementById("coords-display").textContent =
        "Click map to select location";
    } catch (error) {
      this.showModal("error", "Save Failed", error.message);
    }
  };

  this.handleUpdateSpot = async (e) => {
    e.preventDefault();
    const form = e.target;
    const spotId = form.elements.editSpotId.value;
    const lat = form.elements.editSpotLat.value;
    const lng = form.elements.editSpotLng.value;
    const spotType = form.elements.editSpotType.value;
    const linkedId = form.elements.editLinkedId.value;
    const description = form.elements.editSpotDescription.value;

    if (!lat || !lng) {
      return this.showModal(
        "error",
        "Location Missing",
        "Coordinates are missing for the spot."
      );
    }

    try {
      await updateDoc(doc(this.fb.db, this.paths.mapSpots, spotId), {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        spotType,
        linkedId,
        description,
      });
      this.showModal(
        "success",
        "Spot Updated!",
        "The QR spot has been updated."
      );
      this.cancelEditSpot(); // Hide edit form and show add form
    } catch (error) {
      this.showModal("error", "Update Failed", error.message);
    }
  };

  this.handleDeleteSpot = async (spotId) => {
    this.showModal(
      "confirm",
      "Delete Spot?",
      "Are you sure you want to remove this spot from the map?",
      async () => {
        try {
          await deleteDoc(doc(this.fb.db, this.paths.mapSpots, spotId));
          this.showModal(
            "success",
            "Spot Deleted",
            "The spot has been removed."
          );
          // IMPORTANT: After successful deletion from Firestore,
          // you might want to hide the edit form and refresh the map display.
          this.cancelEditSpot(); // This will hide the edit form and show the add form
          // The onSnapshot listener for mapSpots will automatically re-render the map
          // with the updated data from Firestore, so no manual refreshMapSpots() is needed here.
        } catch (error) {
          this.showModal("error", "Delete Failed", error.message);
        }
      }
    );
  };

  this.editSpot = (spotId) => {
    const spot = this.state.mapSpots.find((s) => s.id === spotId);
    if (!spot) return;

    const editForm = document.getElementById("edit-spot-form");
    const addForm = document.getElementById("add-spot-form");
    const editTitle = document.getElementById("edit-spot-title");
    const addTitle = editForm.previousElementSibling.previousElementSibling; // "Add New Spot" title

    // Hide add form, show edit form
    addForm.style.display = "none";
    addTitle.style.display = "none";
    editForm.style.display = "block";
    editTitle.style.display = "block";

    // Populate edit form fields
    editForm.elements.editSpotId.value = spot.id;
    editForm.elements.editSpotLat.value = spot.lat;
    editForm.elements.editSpotLng.value = spot.lng;
    document.getElementById(
      "edit-coords-display"
    ).textContent = `${spot.lat.toFixed(6)}, ${spot.lng.toFixed(6)}`;
    editForm.elements.editSpotType.value = spot.spotType;
    editForm.elements.editSpotDescription.value = spot.description || "";

    // Populate linked item dropdown for edit form
    this.populateAdminSpotForm(true, spot.linkedId); // Pass true for edit mode, and the current linkedId

    // Update map marker (optional, but good for UX)
    // You might need to store the map instance in this.map in initAdminMap
    // if (this.map) {
    //     if (this.currentEditMarker) {
    //         this.map.removeLayer(this.currentEditMarker);
    //     }
    //     this.currentEditMarker = L.marker([spot.lat, spot.lng], { draggable: true }).addTo(this.map);
    //     this.currentEditMarker.on('dragend', (event) => {
    //         const marker = event.target;
    //         const position = marker.getLatLng();
    //         editForm.elements.editSpotLat.value = position.lat;
    //         editForm.elements.editSpotLng.value = position.lng;
    //         document.getElementById('edit-coords-display').textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
    //     });
    // }
  };

  this.cancelEditSpot = () => {
    const editForm = document.getElementById("edit-spot-form");
    const addForm = document.getElementById("add-spot-form");
    const editTitle = document.getElementById("edit-spot-title");
    const addTitle = editForm.previousElementSibling.previousElementSibling; // "Add New Spot" title

    // Hide edit form, show add form
    editForm.style.display = "none";
    editTitle.style.display = "none";
    addForm.style.display = "block";
    addTitle.style.display = "block";

    // Clear edit form fields
    editForm.reset();
    document.getElementById("edit-coords-display").textContent = "";

    // if (this.currentEditMarker && this.map) {
    //     this.map.removeLayer(this.currentEditMarker);
    //     this.currentEditMarker = null;
    // }
  };

  this.openAdminMapPanel = () => {
    const content = `
        <div class="flex flex-col lg:flex-row lg:space-x-4 h-full">
            <!-- Map Area -->
            <div class="lg:w-2/3 h-64 lg:h-full rounded-xl border-2 border-gray-700 mb-4 lg:mb-0">
                <div id="admin-map" class="w-full h-full rounded-xl"></div>
            </div>

            <!-- Form & List Area -->
            <div class="lg:w-1/3 flex flex-col">
                <h3 class="font-semibold text-lg mb-2">Add New Spot</h3>
                <p class="text-sm text-gray-400 mb-4">Click the map to place a pin.</p>
                <form id="add-spot-form" class="space-y-4 bg-gray-800 p-4 rounded-lg">
                    <input type="hidden" name="spotLat">
                    <input type="hidden" name="spotLng">
                    <div>
                        <label class="text-sm text-gray-400">Coordinates</label>
                        <p id="coords-display" class="font-mono text-xs p-2 bg-gray-700 rounded-md">Click map to select location</p>
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Spot Type</label>
                        <select name="spotType" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                            <option value="event">Event</option>
                            <option value="reward">Reward</option>
                            <option value="badge">Badge</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Description</label>
                        <input name="spotDescription" type="text" placeholder="Enter a description for this spot" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Link to Item</label>
                        <select name="linkedId" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></select>
                    </div>
                    <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Save Spot</button>
                </form>

                <h3 class="font-semibold text-lg mt-6 mb-2">Existing Spots</h3>
                <div id="spots-list" class="space-y-2 flex-grow overflow-y-auto no-scrollbar">
                    <!-- List of spots will be populated here -->
                </div>

                <!-- Edit Spot Form (Initially Hidden) -->
                <h3 class="font-semibold text-lg mt-6 mb-2" id="edit-spot-title" style="display:none;">Edit Spot</h3>
                <form id="edit-spot-form" class="space-y-4 bg-gray-800 p-4 rounded-lg" style="display:none;">
                    <input type="hidden" name="editSpotId">
                    <input type="hidden" name="editSpotLat">
                    <input type="hidden" name="editSpotLng">
                    <div>
                        <label class="text-sm text-gray-400">Coordinates</label>
                        <p id="edit-coords-display" class="font-mono text-xs p-2 bg-gray-700 rounded-md"></p>
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Spot Type</label>
                        <select name="editSpotType" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                            <option value="event">Event</option>
                            <option value="reward">Reward</option>
                            <option value="badge">Badge</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Description</label>
                        <input name="editSpotDescription" type="text" placeholder="Enter a description for this spot" class="w-full bg-gray-700 rounded-lg p-3 mt-1">
                    </div>
                    <div>
                        <label class="text-sm text-gray-400">Link to Item</label>
                        <select name="editLinkedId" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></select>
                    </div>
                    <div class="flex space-x-2">
                        <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Update Spot</button>
                        <button type="button" onclick="app.cancelEditSpot()" class="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold">Cancel</button>
                   
                        </div>
                        <button type="button" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold" id="delete-spot-btn">Delete Spot</button>
                </form>
            </div>
        </div>
    `;
    this.openFullscreenModal("Manage QR Code Spots", content);
    this.initAdminMap();
    this.populateAdminSpotForm();
    this.populateSpotsList(); // This will now render with edit/delete buttons

    // Assuming you have a method to refresh the map spots after changes
    this.deleteSpot = (spotId) => {
      // Remove spot from state
      this.state.mapSpots = this.state.mapSpots.filter(
        (spot) => spot.id !== spotId
      );

      // Remove marker from map
      if (this.currentEditMarker) {
        this.map.removeLayer(this.currentEditMarker);
        this.currentEditMarker = null;
      }

      // Hide edit form
      document.getElementById("edit-spot-form").style.display = "none";

      // Refresh the map markers
      this.refreshMapSpots();
    };

    // Add event listener for delete button
    document.getElementById("delete-spot-btn").addEventListener("click", () => {
      const spotId = document.querySelector(
        '#edit-spot-form input[name="editSpotId"]'
      ).value;
      if (spotId && confirm("Are you sure you want to delete this spot?")) {
        // CHANGE THIS LINE: Call the existing handleDeleteSpot function
        this.handleDeleteSpot(spotId);
      }
    });

    // Refresh map spots function to clear and re-add markers
    this.refreshMapSpots = () => {
      // Clear all markers except newSpotMarker and currentEditMarker
      this.map.eachLayer((layer) => {
        if (
          layer instanceof L.Marker &&
          layer !== this.newSpotMarker &&
          layer !== this.currentEditMarker
        ) {
          this.map.removeLayer(layer);
        }
      });

      document
        .getElementById("delete-spot-btn")
        .addEventListener("click", () => {
          const spotId = document.querySelector(
            '#edit-spot-form input[name="editSpotId"]'
          ).value;
          if (spotId && confirm("Are you sure you want to delete this spot?")) {
            // CHANGE THIS LINE: Call the existing handleDeleteSpot function
            this.handleDeleteSpot(spotId);
          }
        });

      // Add markers for all spots in state
      this.state.mapSpots.forEach((spot) => {
        const marker = L.marker([spot.lat, spot.lng]).addTo(this.map);
        marker.on("click", () => {
          this.editSpot(spot.id);
        });
      });
    };

    document
      .querySelector('#add-spot-form select[name="spotType"]')
      .addEventListener("change", () => {
        this.populateAdminSpotForm();
      });
    document
      .getElementById("add-spot-form")
      .addEventListener("submit", this.handleSaveSpot.bind(this));

    // New event listeners for the edit form
    document
      .querySelector('#edit-spot-form select[name="editSpotType"]')
      .addEventListener("change", () => {
        this.populateAdminSpotForm(true); // Pass true to indicate edit mode
      });
    document
      .getElementById("edit-spot-form")
      .addEventListener("submit", this.handleUpdateSpot.bind(this)); // New handler
  };

  // --- LOGGING ---
  this.logAction = async (action, details, pointsChange = null) => {
    const user = this.state.loggedInUser;
    if (!user) return; // Don't log if no user
    const logEntry = {
      timestamp: Timestamp.now(),
      actorId: user.id,
      actorName: `${user.firstName} ${user.lastName}`,
      action: action,
      details: details,
    };
    if (pointsChange) {
      logEntry.beforePoints = pointsChange.before;
      logEntry.afterPoints = pointsChange.after;
    }
    try {
      await addDoc(collection(this.fb.db, this.paths.systemLogs), logEntry);
    } catch (error) {
      console.error("Failed to write to system log:", error);
    }
  };

  this.applyLogFilter = () => {
    const year = document.getElementById("log-year-select").value;
    const month = document.getElementById("log-month-select").value;
    const day = document.getElementById("log-day-select").value;
    this.state.logFilter = { year, month, day };
    this.render();
  };

  // --- CALENDAR ---
  this.generateCalendar = () => {
    const now = this.state.calendarDate;
    const month = now.getMonth();
    const year = now.getFullYear();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleString("default", { month: "long" });

    let calendarHtml = `
        <div class="bg-gray-900/50 p-4 rounded-xl">
            <div class="flex justify-between items-center mb-4">
                <button onclick="app.changeMonth(-1)" class="p-2 rounded-full hover:bg-gray-700"><i data-lucide="chevron-left"></i></button>
                <h3 class="text-lg font-semibold">${monthName} ${year}</h3>
                <button onclick="app.changeMonth(1)" class="p-2 rounded-full hover:bg-gray-700"><i data-lucide="chevron-right"></i></button>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div class="grid grid-cols-7 gap-1">
        `;

    for (let i = 0; i < firstDay; i++) {
      calendarHtml += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = this.state.events.filter((e) => {
        if (!e.timestamp || typeof e.timestamp.seconds !== "number")
          return false; // Bug Fix
        const eventDate = new Date(e.timestamp.seconds * 1000);
        return (
          eventDate.getDate() === day &&
          eventDate.getMonth() === month &&
          eventDate.getFullYear() === year
        );
      });
      const hasEvents = dayEvents.length > 0;
      calendarHtml += `<div class="relative p-2 rounded-lg ${
        hasEvents ? "bg-pink-500/20 cursor-pointer" : ""
      }" ${hasEvents ? `onclick="app.showEventsForDay(${day})"` : ""}>
                ${day}
                ${
                  hasEvents
                    ? '<div class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-400 rounded-full"></div>'
                    : ""
                }
            </div>`;
    }

    calendarHtml += `</div></div>`;
    return calendarHtml;
  };
  this.changeMonth = (delta) => {
    this.state.calendarDate.setMonth(
      this.state.calendarDate.getMonth() + delta
    );
    this.render();
  };
  this.showEventsForDay = (day) => {
    const month = this.state.calendarDate.getMonth();
    const year = this.state.calendarDate.getFullYear();
    const dayEvents = this.state.events.filter((e) => {
      if (!e.timestamp || typeof e.timestamp.seconds !== "number") return false;
      const eventDate = new Date(e.timestamp.seconds * 1000);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
    const content = `<div class="space-y-4">${dayEvents
      .map(
        (event) => `
            <div class="bg-gray-700 p-4 rounded-lg">
                <h3 class="text-lg font-bold">${event.name}</h3>
                <p class="text-sm text-amber-400 mb-2">+${
                  event.points
                } Points for attending</p>
                <p class="text-gray-300 text-sm">${
                  event.description || "No description available."
                }</p>
            </div>
        `
      )
      .join("")}</div>`;
    this.openFullscreenModal(
      `Events for ${this.state.calendarDate.toLocaleString("default", {
        month: "long",
      })} ${day}`,
      content
    );
  };

  // --- QR CODE ---
  this.generateQRCode = (canvasId, text, size) => {
    const canvas = document.getElementById(canvasId);
    if (canvas)
      QRCode.toCanvas(canvas, text, { width: size, margin: 1 }, (err) => {
        if (err) console.error(err);
      });
  };
  this.qrScanner = null;
  this.startScanner = () => {
    const statusEl = document.getElementById("qr-reader-status");

    // This line explicitly asks for camera permissions. This is the key change.
    Html5Qrcode.getCameras()
      .then((cameras) => {
        // This part only runs if the user grants permission.
        if (cameras && cameras.length) {
          this.qrScanner = new Html5Qrcode("qr-reader");
          this.qrScanner
            .start(
              { facingMode: "environment" }, // We'll use the back camera
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
              },
              (decodedText) => {
                this.handleScanSuccess(decodedText);
                this.stopScanner();
              },
              () => {} // Ignore scans that aren't QR codes
            )
            .catch((err) => {
              console.error("Error after starting scanner:", err);
              statusEl.textContent = "Failed to start scanner.";
            });
          statusEl.textContent = "Point camera at a QR code.";
        } else {
          statusEl.textContent = "No cameras found on this device.";
        }
      })
      .catch((err) => {
        // This part runs if the user denies camera permission.
        console.error("Camera permission error:", err);
        statusEl.textContent =
          "Camera access is required. Please grant permission in your app settings.";
      });
  };
  this.stopScanner = () => {
    if (this.qrScanner && this.qrScanner.isScanning) {
      this.qrScanner
        .stop()
        .catch((err) => console.error("Scanner stop failed", err));
    }
  };

  // (Line 1836)
  this.handleScanSuccess = async (decodedText) => {
    try {
      const qrData = JSON.parse(decodedText);
      const user = this.state.loggedInUser;
      const batch = writeBatch(this.fb.db);
      const beforePoints = user.points; // Get points before the change

      if (qrData.type === "event" && qrData.id) {
        const eventRef = doc(this.fb.db, this.paths.eventDoc(qrData.id));
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
          return this.showModal(
            "error",
            "Event Not Found",
            "This event QR code is invalid or the event has been removed."
          );
        }
        const officialEventData = eventSnap.data();
        const checkInRef = doc(
          this.fb.db,
          this.paths.checkIns,
          `${user.id}_${qrData.id}`
        );
        const checkInSnap = await getDoc(checkInRef);
        if (checkInSnap.exists()) {
          return this.showModal(
            "info",
            "Already Checked In",
            `You've already checked in for this event.`
          );
        }

        const afterPoints = beforePoints + officialEventData.points;
        batch.set(checkInRef, {
          userId: user.id,
          eventId: qrData.id,
          timestamp: new Date().toLocaleString(),
        });
        const userRef = doc(this.fb.db, this.paths.userDoc(user.id));
        batch.update(userRef, { points: increment(officialEventData.points) });
        // --- CHANGE IS HERE ---
        await this.addPointLog(
          user.id,
          `Attended: ${officialEventData.name || "Event"}`,
          officialEventData.points,
          batch,
          beforePoints,
          afterPoints
        );
        await this.logAction(
          "EVENT_CHECK_IN",
          `Checked into event: "${officialEventData.name}"`,
          { before: beforePoints, after: afterPoints }
        );

        if (officialEventData.badgeId) {
          await this.awardBadge(user.id, officialEventData.badgeId, batch);
        }

        await batch.commit();
        this.showModal(
          "success",
          "Check-In Successful!",
          `You earned ${officialEventData.points} points.`
        );
        this.checkAndAwardBadges(user.id);
      } else if (qrData.type === "reward" && qrData.id) {
        const rewardRef = doc(this.fb.db, this.paths.rewardDoc(qrData.id));
        const rewardSnap = await getDoc(rewardRef);

        if (!rewardSnap.exists()) {
          return this.showModal(
            "error",
            "Reward Not Found",
            "This reward QR code is invalid or the reward is no longer available."
          );
        }
        const officialRewardData = rewardSnap.data();

        // Check claim limits
        if (
          officialRewardData.claimLimitType === "limited" &&
          officialRewardData.claimsLeft <= 0
        ) {
          return this.showModal(
            "info",
            "Reward Unavailable",
            "This reward has been fully claimed."
          );
        }

        // Check claim frequency
        const todayStr = new Date().toLocaleDateString();
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

        if (officialRewardData.claimType === "daily") {
          const schedule = officialRewardData.dailySchedule || {
            days: [],
            times: [],
          };
          if (!schedule.days.includes(currentDay)) {
            return this.showModal(
              "info",
              "Not Available Today",
              "This reward is not available today."
            );
          }
          const inTimeRange = schedule.times.some(
            (time) => currentTime >= time.start && currentTime <= time.end
          );
          if (!inTimeRange) {
            return this.showModal(
              "info",
              "Not Active Now",
              "This reward is not active at this time. Check the schedule."
            );
          }
          const lastClaimDoc = await getDoc(
            doc(
              this.fb.db,
              this.paths.claimedRewards(user.id),
              `${qrData.id}_${todayStr}`
            )
          );
          if (lastClaimDoc.exists()) {
            return this.showModal(
              "info",
              "Claimed Today",
              "You have already claimed this daily reward today. Try again tomorrow!"
            );
          }
        }

        if (officialRewardData.claimType === "once") {
          const onceClaimDoc = await getDoc(
            doc(this.fb.db, this.paths.claimedRewards(user.id), qrData.id)
          );
          if (onceClaimDoc.exists()) {
            return this.showModal(
              "info",
              "Already Claimed",
              "You have already claimed this reward."
            );
          }
        }

        // Check scheduled dates
        if (officialRewardData.claimType === "scheduled") {
          const activeSchedule = (officialRewardData.schedules || []).find(
            (s) => {
              const start = new Date(s.startDate);
              const end = new Date(s.endDate);
              return now >= start && now <= end;
            }
          );

          if (!activeSchedule) {
            return this.showModal(
              "info",
              "Not Active",
              "This reward is not active at this time."
            );
          }

          // Create a unique ID for this specific claim window
          const claimIdForSchedule = `${qrData.id}_${activeSchedule.startDate}`;
          const scheduledClaimDoc = await getDoc(
            doc(
              this.fb.db,
              this.paths.claimedRewards(user.id),
              claimIdForSchedule
            )
          );

          if (scheduledClaimDoc.exists()) {
            return this.showModal(
              "info",
              "Already Claimed",
              "You have already claimed this reward for this specific schedule."
            );
          }
        }

        const userRef = doc(this.fb.db, this.paths.userDoc(user.id));
        let newPoints = user.points;
        let logMessage = "";

        if (officialRewardData.type === "cost") {
          if (user.points < officialRewardData.cost) {
            return this.showModal(
              "error",
              "Insufficient Points",
              `You need ${officialRewardData.cost} points, but you only have ${user.points}.`
            );
          }
          newPoints -= officialRewardData.cost;
          logMessage = `Redeemed: ${officialRewardData.name || "Reward"}`;
        } else {
          newPoints += officialRewardData.cost;
          logMessage = `Gained: ${officialRewardData.name || "Reward"}`;
        }

        // Set claim record
        if (officialRewardData.claimType === "daily") {
          batch.set(
            doc(
              this.fb.db,
              this.paths.claimedRewards(user.id),
              `${qrData.id}_${todayStr}`
            ),
            { rewardId: qrData.id, timestamp: new Date().toLocaleString() }
          );
        } else if (officialRewardData.claimType === "scheduled") {
          const activeSchedule = (officialRewardData.schedules || []).find(
            (s) => {
              const start = new Date(s.startDate);
              const end = new Date(s.endDate);
              return new Date() >= start && new Date() <= end;
            }
          );
          if (activeSchedule) {
            const claimIdForSchedule = `${qrData.id}_${activeSchedule.startDate}`;
            batch.set(
              doc(
                this.fb.db,
                this.paths.claimedRewards(user.id),
                claimIdForSchedule
              ),
              { rewardId: qrData.id, timestamp: new Date().toLocaleString() }
            );
          }
        } else {
          batch.set(
            doc(this.fb.db, this.paths.claimedRewards(user.id), qrData.id),
            { rewardId: qrData.id, timestamp: new Date().toLocaleString() }
          );
        }

        batch.update(userRef, { points: newPoints });
        if (officialRewardData.claimLimitType === "limited") {
          batch.update(rewardRef, { claimsLeft: increment(-1) });
        }

        // --- CHANGE IS HERE ---
        await this.addPointLog(
          user.id,
          logMessage,
          officialRewardData.type === "cost"
            ? -officialRewardData.cost
            : officialRewardData.cost,
          batch,
          beforePoints,
          newPoints
        );
        await this.logAction(
          "REWARD_CLAIM",
          `Claimed reward: "${officialRewardData.name}"`,
          { before: beforePoints, after: newPoints }
        );

        if (officialRewardData.badgeId) {
          await this.awardBadge(user.id, officialRewardData.badgeId, batch);
        }

        await batch.commit();
        this.showModal(
          "success",
          "Reward Claimed!",
          `You ${officialRewardData.type === "cost" ? "redeemed" : "gained"} ${
            officialRewardData.name || "a reward"
          }.`
        );
        this.checkAndAwardBadges(user.id);
      } else {
        this.showModal(
          "error",
          "Invalid QR Code",
          "This is not a valid BBGS QR code."
        );
      }
      this.navigateTo("dashboard");
    } catch (e) {
      console.error("Scan processing error:", e);
      this.showModal(
        "error",
        "Scan Failed",
        "Could not process the QR code. It might be corrupted or invalid."
      );
    }
  };

  this.renderGames = () => {
    this.elements.mainContent.innerHTML = this.templates.games();
  };

  this.exitFullScreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  this.loadMoreLeaderboard = () => {
    if (this.state.leaderboardLoading) return; // Prevent multiple clicks

    this.state.leaderboardLoading = true;
    this.render(); // Show the loading spinner

    // Use a short delay to let the UI update before loading more
    setTimeout(() => {
      this.state.leaderboardDisplayCount += 10; // Increase the number of users to show
      this.state.leaderboardLoading = false; // Reset the flag
      this.render(); // Re-render with the new items
    }, 500);
  };

  // (This goes after the loadMoreLeaderboard function around line 1999)

  this.fetchAllRewardsForAdmin = async () => {
    try {
      const rewardsRef = collection(this.fb.db, this.paths.rewards);
      const querySnapshot = await getDocs(rewardsRef);
      // This now populates our new, dedicated admin list
      this.state.adminRewards = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      this.render(); // Re-render the admin panel with the complete data
    } catch (error) {
      console.error("Error fetching all rewards for admin:", error);
      this.showModal(
        "error",
        "Load Failed",
        "Could not load rewards for the admin panel."
      );
    }
  };

  this.loadGame = (url) => {
    const iframe = document.getElementById("game-iframe");
    iframe.src = url; // Set the iframe source to the game URL

    // Add the full-screen event listener
    document.addEventListener("fullscreenchange", () => {
      const exitButton = document.getElementById("exit-fullscreen");
      if (document.fullscreenElement) {
        exitButton.style.display = "block"; // Show the exit button
      } else {
        exitButton.style.display = "none"; // Hide the exit button
      }
    });
  };


  this.aboutSound = new Audio("NoteGPT_Speech_1757811715642.mp3");

  this.fetchRewards = async () => {
    if (this.state.rewardsLoading || this.state.rewardsAllLoaded) return;
    this.state.rewardsLoading = true;
    this.render(); // Re-render to show a loading spinner

    try {
      const rewardsRef = collection(this.fb.db, this.paths.rewards);
      const PAGE_SIZE = 10;
      let q;

      if (this.state.rewardsLastDoc) {
        // If we have a 'last document', start the next query after it
        q = query(
          rewardsRef,
          orderBy(documentId()),
          startAfter(this.state.rewardsLastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        // This is the first fetch
        q = query(rewardsRef, orderBy(documentId()), limit(PAGE_SIZE));
      }

      const querySnapshot = await getDocs(q);
      const newRewards = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (querySnapshot.docs.length > 0) {
        // Save the last document from this batch for the next fetch
        this.state.rewardsLastDoc =
          querySnapshot.docs[querySnapshot.docs.length - 1];
      }

      // If we fetched fewer rewards than the page size, we've reached the end
      if (newRewards.length < PAGE_SIZE) {
        this.state.rewardsAllLoaded = true;
      }

      // Add the new rewards to the existing list
      this.state.rewards = [...this.state.rewards, ...newRewards];
    } catch (error) {
      console.error("Error fetching rewards:", error);
      this.showModal("error", "Load Failed", "Could not load rewards.");
    } finally {
      this.state.rewardsLoading = false;
      this.render(); // Re-render with the new data
    }
  };

  this.addPointLog = async (
    userId,
    description,
    points,
    batch,
    beforePoints,
    afterPoints
  ) => {
    const logRef = doc(collection(this.fb.db, this.paths.pointLogs(userId)));
    const logData = {
      description,
      points,
      timestamp: new Date().toLocaleString(),
      beforePoints: beforePoints, // Add this line
      afterPoints: afterPoints, // Add this line
    };
    if (batch) {
      batch.set(logRef, logData);
    } else {
      await setDoc(logRef, logData);
    }
  };
  this.handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.elements.email.value;
    const password = e.target.elements.password.value;
    try {
      const userCredential = await signInWithEmailAndPassword(
        this.fb.auth,
        email,
        password
      );
      const user = this.state.users.find(
        (u) => u.id === userCredential.user.uid
      );
      if (user) {
        this.state.loggedInUser = user;
        await this.logAction("USER_LOGIN", `User logged in.`);
      }
    } catch (error) {
      this.showModal("error", "Login Failed", error.message);
    }
  };

  //HANDLE REGISTER DATA
  this.handleRegister = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newUser = Object.fromEntries(formData.entries());
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.fb.auth,
        newUser.email,
        newUser.password
      );
      const user = userCredential.user;
      const userProfile = {
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        middleName: newUser.middleName || "",
        preferredName: newUser.preferredName || "",
        studentid: newUser.studentid || "",
        suffix: newUser.suffix || "",
        skills: newUser.skills || "",
        contact: newUser.contact || "",
        social: newUser.social || "",
        pronouns: newUser.pronouns || "",
        gender: newUser.gender || "",
        orientation: newUser.orientation || "",
        points: 50,
        profilePic: `https://placehold.co/400x400/F59E0B/FFFFFF?text=${newUser.firstName.charAt(0)}`,
        memberSince: new Date().toLocaleDateString(),
        isPublic: false,
        isValidated: false,
        validatedAt: null,
        earnedBadgeIds: [],
        theme: "default",
        lastSeen: firestoreServerTimestamp(),
        online: true,
      };
      await setDoc(doc(this.fb.db, this.paths.userDoc(user.uid)), userProfile);
      this.state.loggedInUser = { id: user.uid, ...userProfile };
      await this.logAction(
        "USER_REGISTER",
        `New user registered: ${newUser.email}`
      );
      await this.addPointLog(user.uid, "Account Created", 50, null, 0, 50);
    } catch (error) {
      this.showModal("error", "Registration Failed", error.message);
    }
  };

  this.handleLogout = async () => {
    // Set user to offline before signing out
    await this.logAction("USER_LOGOUT", `User logged out.`);
    await signOut(this.fb.auth);
    if (this.state.loggedInUser) {
      const userStatusFirestoreRef = doc(
        this.fb.db,
        this.paths.userDoc(this.state.loggedInUser.id)
      );
      await updateDoc(userStatusFirestoreRef, {
        online: false,
        lastSeen: firestoreServerTimestamp(),
      });
      const userStatusDatabaseRef = ref(
        this.fb.rtdb,
        `/status/${this.state.loggedInUser.id}`
      );
      await set(userStatusDatabaseRef, {
        state: "offline",
        last_changed: serverTimestamp(),
      });
    }
  };

  this.handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.fb.auth, provider);
      const user = result.user;
      const userDocRef = doc(this.fb.db, this.paths.userDoc(user.uid));
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const [firstName, ...lastNameParts] = user.displayName.split(" ");
        const userProfile = {
          email: user.email,
          firstName: firstName || "New",
          lastName: lastNameParts.join(" ") || "User",
          skills: "N/A",
          contact: "",
          social: "",
          points: 100,
          profilePic:
            user.photoURL ||
            `https://placehold.co/400x400/F59E0B/FFFFFF?text=${(
              firstName || "N"
            ).charAt(0)}`,
          memberSince: new Date().toLocaleDateString(),
          isPublic: false,
          isValidated: false,
          validatedAt: null,
          earnedBadgeIds: [],
          theme: "default",
        };
        await setDoc(userDocRef, userProfile);
        this.state.loggedInUser = { id: user.uid, ...userProfile };
        await this.logAction(
          "USER_REGISTER",
          `New user registered with Google: ${user.email}`
        );
        await this.addPointLog(user.uid, "Account Created with Google", 100);
      } else {
        this.state.loggedInUser = { id: user.uid, ...userDoc.data() };
        await this.logAction("USER_LOGIN", `User logged in with Google.`);
      }
    } catch (error) {
      this.showModal("error", "Google Sign-In Failed", error.message);
    }
  };
  this.handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(this.fb.auth);
      if (result) {
        // Logic is now in handleGoogleLogin
      }
    } catch (error) {
      console.error("Google Redirect Error:", error);
      this.showModal("error", "Google Sign-In Failed", error.message);
    }
  };


this.resizeAndCompressImage = (file, maxWidth, maxHeight, quality) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate the new dimensions to maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Get the compressed image Data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};



this.handleProfilePicChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Show a loading/processing modal to the user
  this.showModal("info", "Processing...", "Your photo is being prepared. Please wait.");

  try {
    // --- THIS IS THE NEW PART ---
    // Resize the image to a max of 1024x1024 with 70% quality
    const compressedPicDataUrl = await this.resizeAndCompressImage(file, 1024, 1024, 0.7);
    // --- END OF NEW PART ---

    // Update the UI previews
    const previewPic = document.getElementById("profile-pic-preview");
    if (previewPic) previewPic.src = compressedPicDataUrl;
    const headerPic = document.getElementById("header-profile-pic");
    if (headerPic) headerPic.src = compressedPicDataUrl;

    // Save the compressed image data to Firestore
    await updateDoc(
      doc(this.fb.db, this.paths.userDoc(this.state.firebaseUser.uid)), {
        profilePic: compressedPicDataUrl, // Save the compressed version
      }
    );

    this.showModal(
      "success",
      "Photo Updated",
      "Your new profile picture has been saved."
    );
  } catch (error) {
    console.error("Photo Processing Error:", error);
    this.showModal(
      "error",
      "Update Failed",
      "Could not process or save the new photo."
    );
  }
};


  this.handleProfileUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updatedData = {
      studentid: formData.get("studentid"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      skills: formData.get("skills"),
      contact: formData.get("contact"),
      pronouns: formData.get("pronouns"),
      gender: formData.get("gender"),
      orientation: formData.get("orientation"),
    };
    try {
      await updateDoc(
        doc(this.fb.db, this.paths.userDoc(this.state.firebaseUser.uid)),
        updatedData
      );
      await this.logAction(
        "PROFILE_UPDATE",
        "Updated their profile information."
      );
      this.showModal(
        "success",
        "Profile Updated",
        "Your information has been saved."
      );
    } catch (error) {
      this.showModal("error", "Update Failed", error.message);
    }
  };
  this.updateUserInfo = () => {
    if (this.state.loggedInUser) {
      this.elements.userNameHeader.textContent =
        this.state.loggedInUser.firstName;
      this.elements.userPointsHeader.textContent = `${this.state.loggedInUser.points} PTS`;
      const headerPic = document.getElementById("header-profile-pic");
      if (headerPic) {
        headerPic.src = this.state.loggedInUser.profilePic;
      }
      document.getElementById("admin-dropdown-link").style.display =
        this.state.loggedInUser.email === this.state.adminEmail
          ? "block"
          : "none";
    }
  };
  this.handleDirectoryOptIn = async (isPublic) => {
    await updateDoc(
      doc(this.fb.db, this.paths.userDoc(this.state.firebaseUser.uid)),
      { isPublic }
    );
  };
  this.handleRsvp = async (eventId) => {
    const userId = this.state.firebaseUser.uid;
    const rsvpRef = doc(this.fb.db, this.paths.rsvps(userId), eventId);
    const rsvpSnap = await getDoc(rsvpRef);
    if (rsvpSnap.exists()) {
      await deleteDoc(rsvpRef);
    } else {
      await setDoc(rsvpRef, {
        eventId,
        userId,
        timestamp: new Date().toLocaleString(),
      });
    }
  };

  // --- ADMIN FUNCTIONALITY ---
  this.switchToEditRewardMode = (rewardId) => {
    this.state.adminEditingRewardId = rewardId;
    this.render();
    // Scroll to the form for better UX
    document
      .getElementById("reward-form-panel")
      ?.scrollIntoView({ behavior: "smooth" });
  };
  this.cancelEditRewardMode = () => {
    this.state.adminEditingRewardId = null;
    this.render();
  };
  this.startAdminScanner = async () => {
    const startBtn = document.getElementById("start-scan-btn");
    const statusEl = document.getElementById("admin-scan-status");

    if (this.state.html5QrCode && this.state.html5QrCode.isScanning) {
      this.state.html5QrCode
        .stop()
        .then(() => {
          this.state.html5QrCode = null;
          startBtn.innerHTML =
            '<i data-lucide="camera"></i><span>Start Scan</span>';
          lucide.createIcons();
          statusEl.textContent = "";
        })
        .catch((err) => console.error("Error stopping scanner:", err));
      return;
    }

    this.state.html5QrCode = new Html5Qrcode("admin-qr-reader");
    const qrCodeSuccessCallback = async (decodedText) => {
      if (this.state.html5QrCode.isScanning) {
        this.state.html5QrCode.stop();
      }
      statusEl.textContent = `Processing...`;

      let scannedData;
      try {
        scannedData = JSON.parse(decodedText);
      } catch (e) {
        this.showModal(
          "error",
          "Invalid QR",
          "This is not a valid member QR code."
        );
        statusEl.textContent = "Error!";
        return;
      }

      if (scannedData.type !== "member" || !scannedData.id) {
        this.showModal(
          "error",
          "Wrong QR Type",
          "Please scan a member's personal QR code."
        );
        statusEl.textContent = "Error!";
        return;
      }

      const userId = scannedData.id;
      const rewardSelect = document.getElementById("admin-reward-select");
      const badgeSelect = document.getElementById("admin-badge-select");
      const selectedRewardId = rewardSelect.value;
      const selectedBadgeId = document.getElementById(
        "admin-badge-select-hidden"
      ).value;

      if (!selectedRewardId && !selectedBadgeId) {
        this.showModal(
          "error",
          "No Selection",
          "Please select a reward or a badge to award."
        );
        statusEl.textContent = `Scan failed: No selection.`;
        return;
      }

      try {
        const userRef = doc(this.fb.db, this.paths.userDoc(userId));
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) throw new Error("User not found.");

        const userData = userSnap.data();
        const beforePoints = userData.points;
        let afterPoints = beforePoints;
        let pointsAwarded = 0;
        let badgeAwarded = null;
        const batch = writeBatch(this.fb.db);

        if (selectedRewardId) {
          const reward = this.state.rewards.find(
            (r) => r.id === selectedRewardId
          );
          if (reward) {
            const pointsChange =
              reward.type === "gain" ? reward.cost : -reward.cost;
            pointsAwarded = pointsChange;
            afterPoints += pointsChange;
            batch.update(userRef, { points: increment(pointsChange) });
            await this.addPointLog(
              userId,
              `Admin award: ${reward.name}`,
              pointsChange,
              batch,
              beforePoints,
              afterPoints
            );
            await this.logAction(
              "ADMIN_AWARD_REWARD",
              `Awarded reward "${reward.name}" to ${userData.firstName} ${userData.lastName}.`,
              { before: beforePoints, after: afterPoints }
            );
          }
        }

        if (selectedBadgeId) {
          const badge = this.state.badges.find((b) => b.id === selectedBadgeId);
          if (
            badge &&
            !(userData.earnedBadgeIds || []).includes(selectedBadgeId)
          ) {
            badgeAwarded = badge.name;
            await this.awardBadge(userId, selectedBadgeId, batch); // awardBadge now handles logging
          }
        }

        await batch.commit();

        let successMessage = `Awarded to ${userData.firstName}!`;
        if (pointsAwarded !== 0)
          successMessage += `\n${
            pointsAwarded > 0 ? "+" : ""
          }${pointsAwarded} points.`;
        if (badgeAwarded) successMessage += `\nBadge: ${badgeAwarded}.`;

        this.showModal("success", "Award Successful", successMessage);
        statusEl.textContent = "Success!";
        this.checkAndAwardBadges(userId);
      } catch (error) {
        this.showModal(
          "error",
          "Error",
          `Failed to award user. ${error.message}`
        );
        statusEl.textContent = "Error!";
      } finally {
        startBtn.innerHTML =
          '<i data-lucide="camera"></i><span>Start Scan</span>';
        lucide.createIcons();
      }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    this.state.html5QrCode
      .start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
      .then(() => {
        startBtn.innerHTML =
          '<i data-lucide="camera-off"></i><span>Stop Scan</span>';
        lucide.createIcons();
        statusEl.textContent = "Scanner is active.";
      })
      .catch((err) => {
        statusEl.textContent = "Camera permission denied.";
      });
  };
  this.handleDirectorySearch = () => {
    this.state.directorySearch = document
      .getElementById("directory-search-input")
      .value.toLowerCase();
    this.render();
  };
  this.handleAdminSearch = (type, term) => {
    const lowercasedTerm = term.toLowerCase();
    if (type === "member") this.state.adminMemberSearch = lowercasedTerm;
    if (type === "reward") this.state.adminRewardSearch = lowercasedTerm;
    this.render();
  };
  // (This goes after the handleAdminSearch function around line 2146)

  this.handleAdminRewardSearch = () => {
    const searchTerm = document.getElementById(
      "admin-reward-search-input"
    ).value;
    this.handleAdminSearch("reward", searchTerm);
  };

  this.showAllRewards = () => {
    document.getElementById("admin-reward-search-input").value = ""; // Clear the input
    this.handleAdminSearch("reward", ""); // Search with an empty string
  };
  this.handleCreateEvent = async (e) => {
    e.preventDefault();
    const name = e.target.elements.eventName.value;
    const date = e.target.elements.eventDate.value;
    const description = e.target.elements.eventDescription.value;
    const points = parseInt(e.target.elements.eventPoints.value);
    const badgeId = e.target.elements.badgeId.value;
    const isVisible = e.target.elements.isVisible.checked;
    if (name && points && date) {
      await addDoc(collection(this.fb.db, this.paths.events), {
        name,
        description,
        points,
        badgeId: badgeId || null,
        isVisible,
        timestamp: Timestamp.fromDate(new Date(date)),
      });
      await this.logAction("ADMIN_CREATE_EVENT", `Created event: "${name}".`);
      e.target.reset();
      this.state.adminActiveTab = "events";
    } else {
      this.showModal(
        "error",
        "Invalid Input",
        "Provide a valid event name, date, and points."
      );
    }
  };
  this.loadGame = (url) => {
    const iframe = document.getElementById("game-iframe");
    iframe.src = url; // Set the iframe source to the game URL
  };

  this.handleCreateReward = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get("rewardName");
    const cost = parseInt(formData.get("rewardCost"));
    const type = formData.get("rewardType");
    const badgeId = formData.get("badgeId");
    const claimType = formData.get("claimType");
    const claimLimitType = formData.get("claimLimitType");
    const claimLimit =
      claimLimitType === "limited"
        ? parseInt(formData.get("claimLimit"))
        : null;
    const isVisible = formData.get("isVisible") === "on";

    let schedules = [];
    if (claimType === "scheduled") {
      const dateInputs = document.querySelectorAll(
        'input[name="scheduleDate"]'
      );
      const startInputs = document.querySelectorAll(
        'input[name="scheduleStart"]'
      );
      const endInputs = document.querySelectorAll('input[name="scheduleEnd"]');
      for (let i = 0; i < dateInputs.length; i++) {
        if (dateInputs[i].value && startInputs[i].value && endInputs[i].value) {
          schedules.push({
            startDate: `${dateInputs[i].value}T${startInputs[i].value}`,
            endDate: `${dateInputs[i].value}T${endInputs[i].value}`,
          });
        }
      }
    }

    const dailySchedule = {};
    if (claimType === "daily") {
      const days = [];
      document.querySelectorAll('input[name^="day_"]:checked').forEach((cb) => {
        days.push(parseInt(cb.value));
      });

      const times = [];
      const startInputs = document.querySelectorAll('input[name="dailyStart"]');
      const endInputs = document.querySelectorAll('input[name="dailyEnd"]');
      for (let i = 0; i < startInputs.length; i++) {
        if (startInputs[i].value && endInputs[i].value) {
          times.push({
            start: startInputs[i].value,
            end: endInputs[i].value,
          });
        }
      }
      dailySchedule.days = days;
      dailySchedule.times = times;
    }

    const newReward = {
      name,
      cost,
      type,
      badgeId,
      isVisible,
      claimType,
      claimLimitType,
      claimLimit: claimLimit,
      claimsLeft: claimLimit, // Initialize claimsLeft
      schedules,
      dailySchedule: claimType === "daily" ? dailySchedule : null,
    };

    await addDoc(collection(this.fb.db, this.paths.rewards), newReward);
    await this.logAction("ADMIN_CREATE_REWARD", `Created reward: "${name}".`);
    e.target.reset();
    this.state.adminActiveTab = "rewards";
  };

  // This single function now handles both creating and updating
this.handleSubmitAnnouncement = async (e) => {
  e.preventDefault();
  
  // Get all data from the form, including the hidden ID
  const id = e.target.elements.announcementId.value;
  const title = e.target.elements.announcementTitle.value;
  const message = e.target.elements.announcementMessage.value;
  
  if (!title || !message) return; // Basic validation

  if (id) {
    // If an ID exists, we are UPDATING an existing announcement
    const docRef = doc(this.fb.db, this.paths.announcements, id);
    await updateDoc(docRef, { title, message });
    this.showModal("success", "Updated!", "Announcement has been updated.");
  } else {
    // If no ID exists, we are CREATING a new announcement
    await addDoc(collection(this.fb.db, this.paths.announcements), {
      title,
      message,
      timestamp: new Date().toLocaleString(),
    });
  }
  
  // After either creating or updating, reset the form to its original state
  this.handleCancelEdit();
  this.state.adminActiveTab = "announcements"; // Re-render the view
};
  

  this.handleDeleteAnnouncement = async (id) => {
    await deleteDoc(doc(this.fb.db, this.paths.announcements, id));
  };
  this.handleCreateBadge = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const iconSelect = formData.get("badgeIconSelect");
    const iconText = formData.get("badgeIconText").trim();
    const iconUrl = formData.get("badgeIconUrl").trim();
    const icon = iconUrl || iconText || iconSelect;
    const criteriaValue = formData.get("badgeCriteriaValue");
    const newBadge = {
      name: formData.get("badgeName"),
      description: formData.get("badgeDescription"),
      icon: icon,
      criteria: {
        type: formData.get("badgeCriteriaType"),
        value: criteriaValue ? parseInt(criteriaValue) : 0,
      },
      isVisible: formData.get("isVisible") === "on",
    };
    if (newBadge.name && newBadge.icon) {
      await addDoc(collection(this.fb.db, this.paths.badges), newBadge);
      await this.logAction(
        "ADMIN_CREATE_BADGE",
        `Created badge: "${newBadge.name}".`
      );
      e.target.reset();
      this.state.adminActiveTab = "badges";
    } else {
      this.showModal(
        "error",
        "Invalid Input",
        "Please provide at least a Badge Name and an Icon."
      );
    }
  };
  this.handleDeleteBadge = async (badgeId) => {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) return;
    this.showModal(
      "confirm",
      "Delete Badge?",
      `Are you sure you want to delete this badge? This cannot be undone.`,
      async () => {
        await deleteDoc(doc(this.fb.db, this.paths.badgeDoc(badgeId)));
        await this.logAction(
          "ADMIN_DELETE_BADGE",
          `Deleted badge: "${badge.name}".`
        );
        this.state.adminActiveTab = "badges";
      }
    );
  };
  this.handleAdminUpdateUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get("userId");
    const user = this.state.users.find((u) => u.id === userId);
    if (user) {
      const beforePoints = user.points;
      const afterPoints = parseInt(formData.get("points"), 10);
      const updatedData = {
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        skills: formData.get("skills"),
        points: afterPoints,
        isValidated: formData.get("isValidated") === "on",
      };
      await updateDoc(doc(this.fb.db, this.paths.userDoc(userId)), updatedData);
      await this.logAction(
        "ADMIN_UPDATE_USER",
        `Updated profile for ${user.firstName} ${user.lastName}.`,
        { before: beforePoints, after: afterPoints }
      );
      this.closeFullscreenModal();
      this.showModal(
        "success",
        "Member Updated",
        `${user.firstName}'s profile was updated.`
      );
      this.state.adminActiveTab = "members";
    }
  };
  this.handleAdminApproveUser = async (userId) => {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    await updateDoc(doc(this.fb.db, this.paths.userDoc(userId)), {
      isValidated: true,
      validatedAt: new Date().toLocaleDateString(),
    });
    await this.logAction(
      "ADMIN_APPROVE_USER",
      `Approved user: ${user.firstName} ${user.lastName}.`
    );
    this.showModal(
      "success",
      "User Approved",
      "The member now has full access."
    );
    this.state.adminActiveTab = "verification";
  };
  this.handleAdminUpdateEvent = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const eventId = formData.get("eventId");
    const eventName = formData.get("eventName");
    await updateDoc(doc(this.fb.db, this.paths.eventDoc(eventId)), {
      name: eventName,
      description: formData.get("eventDescription"),
      points: parseInt(formData.get("eventPoints"), 10),
      badgeId: formData.get("badgeId") || null,
      isVisible: formData.get("isVisible") === "on",
      timestamp: Timestamp.fromDate(new Date(formData.get("eventDate"))),
    });
    await this.logAction(
      "ADMIN_UPDATE_EVENT",
      `Updated event: "${eventName}".`
    );
    this.closeFullscreenModal();
    this.showModal(
      "success",
      "Event Updated",
      "The event details have been saved."
    );
    this.state.adminActiveTab = "events";
  };
  this.handleAdminDeleteEvent = async (eventId) => {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event) return;
    this.showModal(
      "confirm",
      "Delete Event?",
      "This will permanently delete the event and its QR code. This cannot be undone.",
      async () => {
        await deleteDoc(doc(this.fb.db, this.paths.eventDoc(eventId)));
        await this.logAction(
          "ADMIN_DELETE_EVENT",
          `Deleted event: "${event.name}".`
        );
        this.closeFullscreenModal();
        this.showModal(
          "success",
          "Event Deleted",
          "The event has been removed."
        );
        this.state.adminActiveTab = "events";
      }
    );
  };
  this.handleAdminUpdateReward = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rewardId = this.state.adminEditingRewardId;
    if (!rewardId) return;

    const rewardName = formData.get("rewardName");
    const cost = parseInt(formData.get("rewardCost"));
    const type = formData.get("rewardType");
    const badgeId = formData.get("badgeId");
    const claimType = formData.get("claimType");
    const claimLimitType = formData.get("claimLimitType");
    const claimLimit =
      claimLimitType === "limited"
        ? parseInt(formData.get("claimLimit"))
        : null;
    const isVisible = formData.get("isVisible") === "on";

    let schedules = [];
    if (claimType === "scheduled") {
      const dateInputs = document.querySelectorAll(
        'input[name="scheduleDate"]'
      );
      const startInputs = document.querySelectorAll(
        'input[name="scheduleStart"]'
      );
      const endInputs = document.querySelectorAll('input[name="scheduleEnd"]');
      for (let i = 0; i < dateInputs.length; i++) {
        if (dateInputs[i].value && startInputs[i].value && endInputs[i].value) {
          schedules.push({
            startDate: `${dateInputs[i].value}T${startInputs[i].value}`,
            endDate: `${dateInputs[i].value}T${endInputs[i].value}`,
          });
        }
      }
    }

    const dailySchedule = {};
    if (claimType === "daily") {
      const days = [];
      document.querySelectorAll('input[name^="day_"]:checked').forEach((cb) => {
        days.push(parseInt(cb.value));
      });

      const times = [];
      const startInputs = document.querySelectorAll('input[name="dailyStart"]');
      const endInputs = document.querySelectorAll('input[name="dailyEnd"]');
      for (let i = 0; i < startInputs.length; i++) {
        if (startInputs[i].value && endInputs[i].value) {
          times.push({
            start: startInputs[i].value,
            end: endInputs[i].value,
          });
        }
      }
      dailySchedule.days = days;
      dailySchedule.times = times;
    }

    const updatedData = {
      name: rewardName,
      cost,
      type,
      badgeId: badgeId || null,
      isVisible,
      claimType,
      claimLimitType,
      claimLimit,
      claimsLeft: claimLimit,
      schedules,
      dailySchedule: claimType === "daily" ? dailySchedule : null,
    };

    await updateDoc(
      doc(this.fb.db, this.paths.rewardDoc(rewardId)),
      updatedData
    );
    await this.logAction(
      "ADMIN_UPDATE_REWARD",
      `Updated reward: "${rewardName}".`
    );
    this.cancelEditRewardMode(); // Go back to 'add' mode
    this.showModal(
      "success",
      "Reward Updated",
      "The reward details have been saved."
    );
  };
  this.handleAdminUpdateBadge = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const badgeId = formData.get("badgeId");
    const badgeName = formData.get("badgeName");
    const iconSelect = formData.get("badgeIconSelect");
    const iconText = formData.get("badgeIconText").trim();
    const iconUrl = formData.get("badgeIconUrl").trim();
    const icon = iconUrl || iconText || iconSelect;
    const criteriaValue = formData.get("badgeCriteriaValue");
    const updatedBadge = {
      name: badgeName,
      description: formData.get("badgeDescription"),
      icon: icon,
      criteria: {
        type: formData.get("badgeCriteriaType"),
        value: criteriaValue ? parseInt(criteriaValue) : 0,
      },
      isVisible: formData.get("isVisible") === "on",
    };
    if (updatedBadge.name && updatedBadge.icon) {
      await updateDoc(
        doc(this.fb.db, this.paths.badgeDoc(badgeId)),
        updatedBadge
      );
      await this.logAction(
        "ADMIN_UPDATE_BADGE",
        `Updated badge: "${badgeName}".`
      );
      this.closeFullscreenModal();
      this.showModal("success", "Badge Updated", "The badge has been saved.");
      this.state.adminActiveTab = "badges";
    } else {
      this.showModal(
        "error",
        "Invalid Input",
        "Please provide at least a Badge Name and an Icon."
      );
    }
  };
  this.handleAdminDeleteUser = (userId) => {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    this.showModal(
      "confirm",
      "Delete User?",
      `Are you sure you want to delete ${user.firstName} ${user.lastName}? This will only remove their data, not their login.`,
      async () => {
        await deleteDoc(doc(this.fb.db, this.paths.userDoc(userId)));
        await this.logAction(
          "ADMIN_DELETE_USER",
          `Deleted user: ${user.firstName} ${user.lastName} (${user.email}).`
        );
        this.closeFullscreenModal();
        this.showModal(
          "success",
          "User Deleted",
          `${user.firstName}'s data has been removed.`
        );
        this.state.adminActiveTab = "members";
      }
    );
  };
  this.handleAdminPasswordReset = (email) => {
    this.showModal(
      "confirm",
      "Send Password Reset?",
      `This will send a password reset link to ${email}.`,
      async () => {
        try {
          await sendPasswordResetEmail(this.fb.auth, email);
          this.showModal(
            "success",
            "Email Sent",
            `A password reset link has been sent to ${email}.`
          );
        } catch (error) {
          this.showModal("error", "Failed to Send", error.message);
        }
      }
    );
  };
  this.handleAdminDeleteReward = (rewardId) => {
    const reward = this.state.rewards.find((r) => r.id === rewardId);
    if (!reward) return;
    this.showModal(
      "confirm",
      "Delete Reward?",
      `Are you sure you want to delete "${reward.name}"?`,
      async () => {
        await deleteDoc(doc(this.fb.db, this.paths.rewards, rewardId));
        await this.logAction(
          "ADMIN_DELETE_REWARD",
          `Deleted reward: "${reward.name}".`
        );
        this.state.adminActiveTab = "rewards";
      }
    );
  };
  this.toggleAdminRewardsView = () => {
    this.state.adminRewardsView =
      this.state.adminRewardsView === "form" ? "list" : "form";
    // If we switch back to the form, make sure we aren't stuck editing an item
    if (this.state.adminRewardsView === "form") {
      this.state.adminEditingRewardId = null;
    }
    this.render(); // Re-render the page to show the new view
  };
  this.handleAdminAddMember = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newUser = Object.fromEntries(formData.entries());
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.fb.auth,
        newUser.email,
        newUser.password
      );
      const user = userCredential.user;
      const userProfile = {
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        skills: newUser.skills || "",
        points: parseInt(newUser.points, 10) || 0,
        profilePic: `https://placehold.co/400x400/F59E0B/FFFFFF?text=${newUser.firstName.charAt(
          0
        )}`,
        memberSince: new Date().toLocaleDateString(),
        isPublic: false,
        isValidated: true,
        validatedAt: new Date().toLocaleDateString(),
        earnedBadgeIds: [],
      };
      await setDoc(doc(this.fb.db, this.paths.userDoc(user.uid)), userProfile);
      await this.logAction(
        "ADMIN_CREATE_USER",
        `Created and validated new user: ${newUser.email}.`
      );
      await this.addPointLog(
        user.uid,
        "Account Created by Admin",
        userProfile.points,
        null,
        0,
        userProfile.points
      );
      this.closeFullscreenModal();
      this.showModal(
        "success",
        "Member Added",
        `Account for ${newUser.firstName} has been created.`
      );
      this.state.adminActiveTab = "members";
    } catch (error) {
      this.showModal("error", "Creation Failed", error.message);
    }
  };

  // --- GAMIFICATION & THEME ---
  this.handleThemeChange = async (theme) => {
    this.applyTheme(theme);
    await updateDoc(
      doc(this.fb.db, this.paths.userDoc(this.state.firebaseUser.uid)),
      { theme }
    );
  };
  this.applyTheme = (theme) => {
    document.body.className = `bg-gray-900 text-white antialiased theme-${
      theme || "default"
    }`;
  };
  this.awardBadge = async (userId, badgeId, batch) => {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    const user = this.state.users.find((u) => u.id === userId);
    if (!badge || !user) return;

    const earnedBadgeRef = doc(
      this.fb.db,
      this.paths.earnedBadges(userId),
      badgeId
    );
    const userRef = doc(this.fb.db, this.paths.userDoc(userId));

    const data = { badgeId: badge.id, earnedAt: new Date().toLocaleString() };
    const logDetails = `User ${user.firstName} ${user.lastName} earned badge: "${badge.name}".`;

    if (batch) {
      batch.set(earnedBadgeRef, data);
      batch.update(userRef, { earnedBadgeIds: arrayUnion(badgeId) });
    } else {
      const localBatch = writeBatch(this.fb.db);
      localBatch.set(earnedBadgeRef, data);
      localBatch.update(userRef, { earnedBadgeIds: arrayUnion(badgeId) });
      await localBatch.commit();
    }

    // Log this action
    await this.logAction("BADGE_EARNED", logDetails);

    setTimeout(() => {
      this.showModal(
        "success",
        "Achievement Unlocked!",
        `You've earned the "${badge.name}" badge!`
      );
    }, 1500);
  };
  this.handleAdminManageBadge = async (userId, badgeId) => {
    const user = this.state.users.find((u) => u.id === userId);
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!user || !badge) return;
    const userRef = doc(this.fb.db, this.paths.userDoc(userId));
    const earnedBadgeRef = doc(
      this.fb.db,
      this.paths.earnedBadges(userId),
      badgeId
    );

    if ((user.earnedBadgeIds || []).includes(badgeId)) {
      // Revoke badge
      await updateDoc(userRef, { earnedBadgeIds: arrayRemove(badgeId) });
      await deleteDoc(earnedBadgeRef);
      await this.logAction(
        "ADMIN_REVOKE_BADGE",
        `Revoked badge "${badge.name}" from ${user.firstName} ${user.lastName}.`
      );
    } else {
      // Grant badge
      await updateDoc(userRef, { earnedBadgeIds: arrayUnion(badgeId) });
      await setDoc(earnedBadgeRef, {
        badgeId: badgeId,
        earnedAt: new Date().toLocaleString(),
      });
      await this.logAction(
        "ADMIN_GRANT_BADGE",
        `Granted badge "${badge.name}" to ${user.firstName} ${user.lastName}.`
      );
    }
    this.openUserEditModal(userId); // Refresh the modal
  };
  this.checkAndAwardBadges = async (userId) => {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;

    const userCheckIns = await getDocs(
      query(
        collection(this.fb.db, this.paths.checkIns),
        where("userId", "==", userId)
      )
    );
    const eventsAttended = userCheckIns.size;

    for (const badge of this.state.badges) {
      const alreadyEarned = (user.earnedBadgeIds || []).includes(badge.id);
      if (alreadyEarned) continue;

      let criteriaMet = false;
      if (
        badge.criteria.type === "points" &&
        user.points >= badge.criteria.value
      ) {
        criteriaMet = true;
      } else if (
        badge.criteria.type === "events" &&
        eventsAttended >= badge.criteria.value
      ) {
        criteriaMet = true;
      }

      if (criteriaMet) {
        await this.awardBadge(userId, badge.id);
      }
    }
  };

  // --- MODAL & UI LOGIC ---
  this.addDailyTimeRow = (start = "", end = "") => {
    const container = document.getElementById("daily-times-container");
    if (!container) return; // FIX: Add a guard clause
    const row = document.createElement("div");
    row.className = "flex items-center space-x-2";
    row.innerHTML = `
            <input type="time" name="dailyStart" class="w-full bg-gray-600 rounded-lg p-2 text-sm" value="${start}">
            <span class="text-gray-400">-</span>
            <input type="time" name="dailyEnd" class="w-full bg-gray-600 rounded-lg p-2 text-sm" value="${end}">
            <button type="button" onclick="this.parentElement.remove()" class="p-2 bg-red-500/20 text-red-400 rounded-md"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
    container.appendChild(row);
    lucide.createIcons();
  };
  this.addScheduleRow = (date = "", start = "", end = "") => {
    const container = document.getElementById("scheduled-dates-container");
    if (!container) return; // FIX: Add a guard clause
    const row = document.createElement("div");
    row.className = "flex items-center space-x-2";
    row.innerHTML = `
            <input type="date" name="scheduleDate" class="w-full bg-gray-600 rounded-lg p-2 text-sm" value="${date}">
            <input type="time" name="scheduleStart" class="w-full bg-gray-600 rounded-lg p-2 text-sm" value="${start}">
            <input type="time" name="scheduleEnd" class="w-full bg-gray-600 rounded-lg p-2 text-sm" value="${end}">
            <button type="button" onclick="this.parentElement.remove()" class="p-2 bg-red-500/20 text-red-400 rounded-md"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
    container.appendChild(row);
    lucide.createIcons();
  };
  this.renderBadgeIcon = (icon, classes) => {
    if (!icon) return "";
    if (icon.startsWith("http")) {
      return `<img src="${icon}" class="${classes} object-cover">`;
    }
    return `<i data-lucide="${icon}" class="${classes}"></i>`;
  };

  this.openAdminBadgeSelector = () => {
    const content = `
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">
                ${this.state.badges
                  .map(
                    (badge) => `
                    <div class="badge-selector-item text-center p-2 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600" 
                         onclick="app.handleAdminBadgeSelect('${badge.id}')">
                        ${this.renderBadgeIcon(
                          badge.icon,
                          "w-12 h-12 mx-auto text-amber-400"
                        )}
                        <p class="text-xs mt-2 font-semibold">${badge.name}</p>
                    </div>
                `
                  )
                  .join("")}
            </div>
        `;
    this.openFullscreenModal("Select a Badge to Award", content);
  };

  this.handleAdminBadgeSelect = (badgeId) => {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) return;

    // Store the selected ID in our hidden input
    document.getElementById("admin-badge-select-hidden").value = badgeId;

    // Update the button's preview to show the selected badge
    const previewElement = document.getElementById(
      "admin-badge-selector-preview"
    );
    previewElement.innerHTML = `
            <div class="flex items-center space-x-3">
                ${this.renderBadgeIcon(badge.icon, "w-8 h-8 text-amber-400")}
                <span class="font-semibold">${badge.name}</span>
            </div>
            <i data-lucide="chevron-down"></i>
        `;
    lucide.createIcons(); // Re-render the chevron icon

    this.closeFullscreenModal();
  };

  this.renderThemeOption = (themeId, themeName, bgClass, activeTheme) => {
    const isActive = themeId === activeTheme;
    return `
            <button onclick="app.handleThemeChange('${themeId}')" class="flex flex-col items-center space-y-2 p-2 rounded-lg ${
      isActive ? "bg-gray-600" : "bg-gray-700"
    }">
                <div class="w-8 h-8 rounded-full ${bgClass} ${
      isActive ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-gray-700" : ""
    }"></div>
                <span class="text-xs">${themeName}</span>
            </button>
        `;
  };

  this.getIconOptions = () => {
    const icons = [
      "award",
      "badge-check",
      "bone",
      "bot",
      "box",
      "briefcase",
      "cake",
      "camera",
      "car",
      "cat",
      "check-circle-2",
      "chef-hat",
      "cherry",
      "church",
      "clap",
      "clover",
      "coffee",
      "compass",
      "computer",
      "construction",
      "contact",
      "cookie",
      "crown",
      "cup-soda",
      "diamond",
      "dice-5",
      "disc",
      "dog",
      "dollar-sign",
      "donut",
      "drama",
      "dribbble",
      "droplet",
      "dumbbell",
      "egg-fried",
      "feather",
      "figma",
      "film",
      "fish",
      "flag",
      "flame",
      "flask-conical",
      "flower-2",
      "folder",
      "footprints",
      "gamepad-2",
      "gem",
      "ghost",
      "gift",
      "git-branch",
      "github",
      "gitlab",
      "glass-water",
      "glasses",
      "globe",
      "grape",
      "guitar",
      "hammer",
      "hand",
      "hand-heart",
      "hand-metal",
      "hard-hat",
      "heart",
      "heart-pulse",
      "hexagon",
      "home",
      "ice-cream",
      "key",
      "keyboard",
      "lamp",
      "laptop",
      "leaf",
      "lightbulb",
      "linkedin",
      "map",
      "medal",
      "megaphone",
      "mic",
      "moon",
      "mouse-pointer-2",
      "music",
      "palette",
      "party-popper",
      "pencil",
      "pizza",
      "plane",
      "plug",
      "puzzle",
      "rocket",
      "save",
      "school",
      "scissors",
      "shield",
      "skull",
      "slack",
      "smartphone",
      "sprout",
      "star",
      "sun",
      "swords",
      "trello",
      "trophy",
      "twitter",
      "umbrella",
      "university",
      "video",
      "wallet",
      "wand",
      "watch",
      "waves",
      "wind",
      "wrench",
      "youtube",
      "zap",
    ];
    return (
      `<option value="">No Icon (Use Name)</option>` +
      icons
        .map(
          (icon) =>
            `<option value="${icon}">${
              icon.charAt(0).toUpperCase() + icon.slice(1).replace("-", " ")
            }</option>`
        )
        .join("")
    );
  };
  this.openFullscreenModal = (title, content) => {
    this.elements.fullscreenModalTitle.textContent = title;
    this.elements.fullscreenModalContent.innerHTML = content;
    this.elements.fullscreenModal.classList.remove("hidden");
    lucide.createIcons();
  };
  this.closeFullscreenModal = () =>
    this.elements.fullscreenModal.classList.add("hidden");
  this.openMemberQrModal = () => {
    const user = this.state.loggedInUser;
    if (!user) return;
    const content = `
            <div class="text-center">
                <p class="mb-4 text-lg font-semibold">${user.firstName} ${user.lastName}</p>
                <div class="bg-white p-4 rounded-xl max-w-xs mx-auto">
                    <canvas id="modal-member-qr"></canvas>
                </div>
                <p class="mt-4 text-gray-400">Present this code for event check-ins and rewards.</p>
            </div>
        `;
    this.openFullscreenModal(`My Pride Pass`, content);
    this.generateQRCode(
      "modal-member-qr",
      JSON.stringify({ type: "member", id: user.id }),
      256
    );
  };


  this.openMemberDetailsModal = (userId) => {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    const earnedBadges = (user.earnedBadgeIds || []).map((badgeId) => this.state.badges.find((b) => b.id === badgeId)).filter(Boolean);
    const content = `<div class="text-center space-y-4"><img src="${user.profilePic }" class="w-32 h-32 rounded-full mx-auto object-cover border-4 border-purple-500">
    
    <h2 class="text-2xl font-bold">${user.firstName} ${user.lastName}</h2>
    <h4 class="text-l font-bold">Student ID: ${user.studentid || user.firstName} </h4>
    <p>${user.pronouns || ""}  | ${user.gender ||""}  | ${user.orientation || ""}</p>
    <p class="text-gray-400">${user.skills || "No skills listed"}</p>
    <div class="flex items-center justify-center space-x-2"">
      <i data-lucide="phone" class="w-4 h-4 text-gray-400"></i>
      <a href="tel:${user.contact}" class="text-sm text-pink-400 hover:text-pink-300">${user.contact}</a>
    </div>

    <div class="mt-4 border-t border-gray-600 pt-4">
      <h4 class="font-semibold text-center mb-2">Earned Badges</h4>
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-4">${earnedBadges.length > 0 ? earnedBadges.map((badge) => `<div class="text-center p-2 bg-gray-700 rounded-lg">${this.renderBadgeIcon(
                  badge.icon,
                  "w-10 h-10 mx-auto text-amber-400"
                )}<p class="text-xs mt-2 font-semibold">${badge.name}</p></div>`
            )
            .join("")
        : '<p class="text-gray-400 col-span-full">No badges earned yet.</p>'
    }</div></div></div>`;
    this.openFullscreenModal(`Member Details`, content);
  };
  this.openUserEditModal = (userId) => {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) return;
    const content = `<form id="admin-edit-user-form" class="space-y-4"><input type="hidden" name="userId" value="${
      user.id
    }"><div class="grid grid-cols-2 gap-4"><div><label class="text-sm text-gray-400">First Name</label><input name="firstName" value="${
      user.firstName
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Last Name</label><input name="lastName" value="${
      user.lastName
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div></div><div><label class="text-sm text-gray-400">Skills</label><input name="skills" value="${
      user.skills
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Points</label><input name="points" type="number" value="${
      user.points
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div class="bg-gray-900/50 p-4 rounded-lg flex justify-between items-center"><label for="is-validated" class="font-semibold">Validated Member</label><input type="checkbox" id="is-validated" name="isValidated" ${
      user.isValidated ? "checked" : ""
    } class="h-6 w-6 rounded-md accent-pink-500"></div><p class="text-xs text-gray-400 text-center">Validated on: ${
      user.validatedAt || "N/A"
    }</p><button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold mt-4">Save Changes</button><div class="flex space-x-2"><button type="button" onclick="app.handleAdminPasswordReset('${
      user.email
    }')" class="w-full bg-blue-500/20 text-blue-400 py-3 rounded-lg font-semibold mt-2">Send Password Reset</button><button type="button" onclick="app.handleAdminDeleteUser('${
      user.id
    }')" class="w-full bg-red-500/20 text-red-400 py-3 rounded-lg font-semibold mt-2">Delete User</button></div><div class="mt-4 border-t border-gray-600 pt-4"><h4 class="font-semibold text-center mb-2">Manage Badges</h4><div class="space-y-2">${this.state.badges
      .map((badge) => {
        const hasBadge = (user.earnedBadgeIds || []).includes(badge.id);
        return `<div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg"> <div class="flex items-center space-x-2"> ${this.renderBadgeIcon(
          badge.icon,
          "w-5 h-5 text-amber-400"
        )} <p>${
          badge.name
        }</p> </div> <button type="button" onclick="app.handleAdminManageBadge('${
          user.id
        }', '${badge.id}')" class="px-3 py-1 text-xs font-semibold rounded-md ${
          hasBadge
            ? "bg-red-500/20 text-red-400"
            : "bg-green-500/20 text-green-400"
        }">${hasBadge ? "Revoke" : "Grant"}</button> </div>`;
      })
      .join("")}</div></div></form>`;
    this.openFullscreenModal(`Edit ${user.firstName}'s Profile`, content);
    document
      .getElementById("admin-edit-user-form")
      .addEventListener("submit", this.handleAdminUpdateUser.bind(this));
  };
  this.openAddMemberModal = () => {
    const content = `<form id="admin-add-user-form" class="space-y-4"><div class="grid grid-cols-2 gap-4"><div><label class="text-sm text-gray-400">First Name*</label><input name="firstName" required class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Last Name*</label><input name="lastName" required class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div></div><div><label class="text-sm text-gray-400">Email*</label><input name="email" type="email" required class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Password*</label><input name="password" required class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Skills</label><input name="skills" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Starting Points</label><input name="points" type="number" value="0" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold mt-4">Create Account</button></form>`;
    this.openFullscreenModal("Add New Member", content);
    document
      .getElementById("admin-add-user-form")
      .addEventListener("submit", this.handleAdminAddMember.bind(this));
  };

  this.openBadgeEditModal = (badgeId) => {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) return;
    const content = `<form id="admin-edit-badge-form" class="space-y-4"><input type="hidden" name="badgeId" value="${
      badge.id
    }"><input name="badgeName" value="${
      badge.name
    }" type="text" placeholder="Badge Name" required class="w-full bg-gray-700 rounded-lg p-3"><input name="badgeDescription" value="${
      badge.description
    }" type="text" placeholder="Description" required class="w-full bg-gray-700 rounded-lg p-3"><div x-data="{ method: 'select' }"><label class="text-sm text-gray-400">Icon</label><div class="flex space-x-2 p-1 bg-gray-800 rounded-lg my-1"><button type="button" @click="method = 'select'" :class="{ 'pride-gradient-bg text-white': method === 'select', 'bg-gray-700': method !== 'select' }" class="flex-1 py-1 rounded-md text-sm">Select from List</button><button type="button" @click="method = 'text'" :class="{ 'pride-gradient-bg text-white': method === 'text', 'bg-gray-700': method !== 'text' }" class="flex-1 py-1 rounded-md text-sm">Type Name</button><button type="button" @click="method = 'url'" :class="{ 'pride-gradient-bg text-white': method === 'url', 'bg-gray-700': method !== 'url' }" class="flex-1 py-1 rounded-md text-sm">Use URL</button></div><div x-show="method === 'select'"><div class="flex items-center space-x-2"><select name="badgeIconSelect" class="w-full bg-gray-700 rounded-lg p-3">${this.getIconOptions()}</select></div></div><div x-show="method === 'text'" style="display: none;"><input name="badgeIconText" value="${
      badge.icon.startsWith("http") ? "" : badge.icon
    }" type="text" placeholder="e.g., 'rocket', 'award'" class="w-full bg-gray-700 rounded-lg p-3"></div><div x-show="method === 'url'" style="display: none;"><input name="badgeIconUrl" value="${
      badge.icon.startsWith("http") ? badge.icon : ""
    }" type="url" placeholder="https://example.com/icon.png" class="w-full bg-gray-700 rounded-lg p-3"></div></div><div x-data="{ criteria: '${
      badge.criteria.type
    }' }"><label class="text-sm text-gray-400">Criteria</label><select name="badgeCriteriaType" @change="criteria = $event.target.value" class="w-full bg-gray-700 rounded-lg p-3 mt-1"><option value="special" ${
      badge.criteria.type === "special" ? "selected" : ""
    }>Special (Admin Awarded)</option><option value="points" ${
      badge.criteria.type === "points" ? "selected" : ""
    }>Points Earned</option><option value="events" ${
      badge.criteria.type === "events" ? "selected" : ""
    }>Events Attended</option></select><div x-show="criteria !== 'special'"><input name="badgeCriteriaValue" value="${
      badge.criteria.value || ""
    }" type="number" placeholder="Value (e.g., 500)" class="w-full bg-gray-700 rounded-lg p-3 mt-2"></div></div><div class="flex items-center space-x-2"><input type="checkbox" id="badge-visible-edit" name="isVisible" ${
      badge.isVisible ? "checked" : ""
    } class="h-5 w-5 rounded accent-pink-500"><label for="badge-visible-edit">Visible to Members</label></div><button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold">Save Changes</button></form>`;
    this.openFullscreenModal(`Edit Badge: ${badge.name}`, content);
    document
      .getElementById("admin-edit-badge-form")
      .addEventListener("submit", this.handleAdminUpdateBadge.bind(this));
  };
  this.openRewardQrModal = (rewardId) => {
    const reward = this.state.rewards.find((r) => r.id === rewardId);
    if (!reward) return;
    const content = `<div class="text-center"><p class="mb-4 text-lg font-semibold">${
      reward.name
    }</p><div class="bg-white p-4 rounded-xl max-w-xs mx-auto"><canvas id="modal-reward-qr"></canvas></div><p class="mt-4 text-gray-400">Scan this code to ${
      reward.type === "cost"
        ? `redeem for ${reward.cost} points`
        : `gain ${reward.cost} points`
    }.</p></div>`;
    this.openFullscreenModal(`Reward QR Code`, content);
    this.generateQRCode(
      "modal-reward-qr",
      JSON.stringify({ type: "reward", id: reward.id }),
      256
    );
  };
  // (Line 2417)
  this.openPointsLogModal = () => {
    const logs = this.state.pointLogs;
    const content = `<div class="space-y-3">${
      logs
        .map(
          (log) =>
            `<div class="bg-gray-700 p-3 rounded-lg">
    <div class="flex justify-between items-center">
        <p>${log.description}</p>
        <p class="font-bold ${
          log.points >= 0 ? "text-green-400" : "text-red-400"
        }">
            ${log.points >= 0 ? "+" : ""}${log.points} PTS
        </p>
    </div>
    ${
      log.beforePoints !== undefined && log.afterPoints !== undefined
        ? `<p class="text-xs text-gray-400">Points: ${log.beforePoints} → ${log.afterPoints}</p>`
        : ""
    }
    <p class="text-xs text-gray-400 mt-1">${log.timestamp}</p>
</div>`
        )
        .join("") ||
      '<p class="text-center text-gray-400">No transactions yet.</p>'
    }</div>`;
    this.openFullscreenModal("Points History", content);
  };

  this.openEventDetailsModal = async (eventId) => {
    const event = this.state.events.find((e) => e.id === eventId);
    if (!event) return;
    const checkInsCollection = collection(this.fb.db, this.paths.checkIns);
    const q = query(checkInsCollection, where("eventId", "==", eventId));
    const snapshot = await getDocs(q);
    const attendees = [];
    for (const doc of snapshot.docs) {
      const checkInData = doc.data();
      const user = this.state.users.find((u) => u.id === checkInData.userId);
      if (user) attendees.push({ user, timestamp: checkInData.timestamp });
    }
    const eventDate = event.timestamp
      ? new Date(event.timestamp.seconds * 1000).toISOString().slice(0, 16)
      : "";
    const content = `<div x-data="{ tab: 'details' }"><div class="flex space-x-2 mb-4 bg-gray-900 rounded-lg p-1"><button @click="tab = 'details'" :class="{ 'bg-gray-700': tab === 'details' }" class="flex-1 py-2 rounded-md font-semibold text-sm">Details & QR</button><button @click="tab = 'attendees'" :class="{ 'bg-gray-700': tab === 'attendees' }" class="flex-1 py-2 rounded-md font-semibold text-sm">Attendees (${
      attendees.length
    })</button></div><div x-show="tab === 'details'"><form id="admin-edit-event-form" class="space-y-4 mb-6"><input type="hidden" name="eventId" value="${
      event.id
    }"><div><label class="text-sm text-gray-400">Event Name</label><input name="eventName" value="${
      event.name
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Event Date & Time</label><input name="eventDate" type="datetime-local" value="${eventDate}" required class="w-full bg-gray-700 rounded-lg p-3 mt-1 text-white"></div><div><label class="text-sm text-gray-400">Description</label><textarea name="eventDescription" class="w-full bg-gray-700 rounded-lg p-3 h-24">${
      event.description || ""
    }</textarea></div><div><label class="text-sm text-gray-400">Points</label><input name="eventPoints" type="number" value="${
      event.points
    }" class="w-full bg-gray-700 rounded-lg p-3 mt-1"></div><div><label class="text-sm text-gray-400">Optional Badge Reward</label><select name="badgeId" class="w-full bg-gray-700 rounded-lg p-3 mt-1"><option value="">No Badge for this Event</option>${this.state.badges
      .map(
        (badge) =>
          `<option value="${badge.id}" ${
            event.badgeId === badge.id ? "selected" : ""
          }>${badge.name}</option>`
      )
      .join(
        ""
      )}</select></div><div class="flex items-center space-x-2"><input type="checkbox" id="event-visible-edit" name="isVisible" ${
      event.isVisible ? "checked" : ""
    } class="h-5 w-5 rounded accent-pink-500"><label for="event-visible-edit">Visible to Members</label></div>
      <button type="submit" class="w-full pride-gradient-bg text-white py-3 rounded-lg font-semibold mt-2">Save Event Changes</button>
      <button type="button" onclick="app.handleAdminDeleteEvent('${
        event.id
      }')" class="w-full bg-red-500/20 text-red-400 py-3 rounded-lg font-semibold mt-2">Delete Event</button>
    
    
    </form>
     <button onclick="app.downloadAttendees('${event.id}', '${
      event.name
    }')" class="p-2 bg-green-500/20 text-green-400 rounded-md">
    <i data-lucide="download" class="w-4 h-4"></i><span>Download Attendees</span>
</button>
    <div class="text-center">
      <p class="mb-2 font-semibold">Event QR Code</p>
        <div class="bg-white p-2 rounded-xl max-w-xs mx-auto"><canvas id="detail-event-qr">
        </canvas></div></div></div>
        
    <div x-show="tab === 'attendees'" style="display: none;">
     
    <div class="space-y-2">${
      attendees
        .map(
          (a) =>
            `<div class="bg-gray-700 p-3 rounded-lg"><div class="flex items-center justify-between">
     
            <p class="font-semibold">${a.user.firstName} ${a.user.lastName}</p>
            <p class="text-xs text-gray-400">${a.timestamp}</p></div></div>`
        )
        .join("") ||
      '<p class="text-center text-gray-400">No one has checked in yet.</p>'
    }</div></div></div>`;
    this.openFullscreenModal(`Manage: ${event.name}`, content);
    this.generateQRCode(
      "detail-event-qr",
      JSON.stringify({ type: "event", id: event.id }),
      200
    );
    document
      .getElementById("admin-edit-event-form")
      .addEventListener("submit", this.handleAdminUpdateEvent.bind(this));
  };

  this.openBadgeDetailsModal = (name, description, icon, earned) => {
    const content = `<div class="text-center space-y-4"><div class="mx-auto w-32 h-32 flex items-center justify-center">${this.renderBadgeIcon(
      icon,
      "w-24 h-24 " + (earned ? "text-amber-400" : "text-gray-500")
    )}</div><h2 class="text-2xl font-bold">${name}</h2><p class="text-gray-400">${description}</p><p class="font-bold ${
      earned ? "text-green-400" : "text-red-400"
    }">${earned ? "✓ Earned" : "Not Yet Earned"}</p></div>`;
    this.openFullscreenModal("Badge Details", content);
  };

  this.showModal = (type, title, message, onConfirm = null) => {
    const icons = {
      success:
        '<svg class="w-16 h-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
      error:
        '<svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
      info: '<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
      confirm:
        '<svg class="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
    };
    this.elements.modalIcon.innerHTML = icons[type];
    this.elements.modalTitle.textContent = title;
    this.elements.modalMessage.textContent = message;
    this.elements.modalButtons.innerHTML = "";
    if (type === "confirm") {
      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = "Confirm";
      confirmBtn.className = "w-full py-3 rounded-lg font-semibold bg-red-500";
      confirmBtn.onclick = () => {
        onConfirm();
        this.elements.modal.classList.add("hidden");
      };
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.className = "w-full py-3 rounded-lg font-semibold bg-gray-600";
      cancelBtn.onclick = () => this.elements.modal.classList.add("hidden");
      this.elements.modalButtons.appendChild(confirmBtn);
      this.elements.modalButtons.appendChild(cancelBtn);
    } else {
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      const colors = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500",
      };
      closeBtn.className = `w-full py-3 rounded-lg font-semibold ${colors[type]}`;
      closeBtn.onclick = () => this.elements.modal.classList.add("hidden");
      this.elements.modalButtons.appendChild(closeBtn);
    }
    this.elements.modal.classList.remove("hidden");
  };

  this.handleTermsChange = (isChecked) => {
    // Find the button by its new ID
    const registerButton = document.getElementById('register-button');
    
    // Make sure the button exists before trying to change it
    if (registerButton) {
        if (isChecked) {
            // If the box is checked, enable the button
            registerButton.disabled = false;
            registerButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            // If the box is unchecked, disable the button
            registerButton.disabled = true;
            registerButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
};
};

//APP MAIN MAIN
const app = new App();
window.app = app; // Make app globally accessible for inline event handlers

// Initialize the main application immediately when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  app.init();
  
  // FIX: Use event delegation for forms that might not exist on page load
  app.elements.mainContent.addEventListener("submit", (e) => {
    if (e.target.id === "login-form") {
      e.preventDefault();
      app.handleLogin(e);
    } else if (e.target.id === "register-form") {
      e.preventDefault();
      app.handleRegister(e);
    }else if (e.target.id === "announcement-form") {
      e.preventDefault();
      app.handleSubmitAnnouncement(e);
    }
    else if (e.target.id === "carousel-item-form") {
  e.preventDefault();
  app.handleSubmitCarouselItem(e);
}
  });

  // Add event delegation for badge clicks
  app.elements.mainContent.addEventListener("click", (e) => {
    const badgeElement = e.target.closest(".badge-item");
    if (badgeElement) {
      const name = badgeElement.dataset.name;
      const description = badgeElement.dataset.description;
      const icon = badgeElement.dataset.icon;
      const earned = badgeElement.dataset.earned === "true";
      app.openBadgeDetailsModal(name, description, icon, earned);
    }
  });
});
