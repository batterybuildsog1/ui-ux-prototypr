/**
 * MortgageDataCollection - Manages the mortgage data collection workflow
 * Uses the SheetController to provide a progressively disclosed interface
 * Follows Bruno Stasse's Silk design principles for an elegant, native-like experience
 */
class MortgageDataCollection {
  /**
   * Initialize the mortgage data collection
   * @param {HTMLElement} container - Container element for the sheet
   */
  constructor(container) {
    this.container = container;

    // Create our sheet controller with optimized physics for natural feel
    this.sheetController = new SheetController(container, {
      initialPosition: 'half', // Changed from 'docked' to 'half' to ensure visibility
      snapPoints: {
        closed: 0,
        docked: 0.15,
        half: 0.5,
        full: 0.95 // Override: Target 95% height for 'full' state
      },
      // Calibrated spring physics for a natural, native-like feel
      mass: 1,
      stiffness: 320, // Note: Physics constants can also be overridden here if needed
      damping: 28,
      allowOvershoot: true
    });

    // Force the sheet to be visible after a longer delay to ensure DOM is ready
    setTimeout(() => {
      console.log("Setting initial position. Viewport Height:", this.sheetController.viewportHeight); // Added log
      this.sheetController.setPosition('half', false);
    }, 500); // Increased timeout to 500ms

    // Create data model
    this.data = {
      // Home Purchase Goals
      targetHomePrice: '',
      downPayment: '',
      downPaymentPercent: '',

      // Income
      monthlyIncome: '',
      incomeSources: [],
      incomeTrend: '',

      // Debt
      carPayment: '',
      creditCardMinimums: '',
      otherDebts: '',

      // Housing
      currentHousingExpense: '',
      residencyDuration: '',

      // Credit
      creditScoreRange: '',

      // Assets
      liquidCash: '',
      retirementInvestments: '',
      otherLiquidAssets: '',

      // Payment History
      latePayments: false,
      bankruptcy: false,

      // Medical & Collections
      medicalDebt: '',
      collectionsPayments: ''
    };

    // Track current section and page
    this.currentSection = 'goals-income';
    this.currentPage = 1;
    this.totalPages = 4;

    // Store form completion status
    this.completionStatus = {
      'goals-income': [false, false],
      'debt-housing': [false, false],
      'credit-assets': [false, false],
      'payment-medical': [false, false]
    };

    // Load saved data if available
    this.loadData();

    // Update completion status
    this.updateCompletionStatus();

    // Set up event listeners
    this.setupEventListeners();

    // Initialize content
    this.renderCurrentSection();
  }

  /**
   * Set up event listeners for the form with improved gesture support
   */
  setupEventListeners() {
    // Listen for sheet position changes
    this.sheetController.onPositionChange(position => {
      this.handlePositionChange(position);
    });

    // Listen for form navigation with delegate pattern for better performance
    document.addEventListener('click', e => {
      // Button handlers
      if (e.target.matches('.next-button')) {
        this.nextPage();
      } else if (e.target.matches('.prev-button')) {
        this.previousPage();
      } else if (e.target.matches('.section-button')) {
        this.changeSection(e.target.dataset.section);
      } else if (e.target.matches('.expand-button')) {
        this.sheetController.setPosition('half');
      } else if (e.target.matches('.view-affordability-button')) {
        this.showAffordability(this.calculatedMaxDti);
      } else if (e.target.matches('.edit-info-button')) {
        this.sheetController.setPosition('full');
        this.renderFullForm();
      } else if (e.target.matches('.back-button')) {
        this.calculateResults();
      } else if (e.target.matches('.calculate-button') || e.target.matches('.submit-button')) {
        this.calculateResults();
      }
    });

    // Listen for form input changes with debouncing
    let inputDebounceTimer;
    document.addEventListener('input', e => {
      if (e.target.name) {
        // Clear existing timeout
        clearTimeout(inputDebounceTimer);

        // Set new timeout to update after typing stops
        inputDebounceTimer = setTimeout(() => {
          this.handleInputChange(e.target);
        }, 300);
      }
    });

    // Add immediate update for checkbox changes
    document.addEventListener('change', e => {
      if (e.target.type === 'checkbox' || e.target.type === 'radio') {
        this.handleInputChange(e.target);
      }
    });

    // Listen for sheet drag start/end for reactive UI
    this.sheetController.onDragStart(() => {
      // Add visual cues when dragging
      document.body.classList.add('sheet-dragging');
    });

    this.sheetController.onDragEnd(() => {
      // Remove visual cues when dragging ends
      document.body.classList.remove('sheet-dragging');
    });
  }

  /**
   * Handle sheet position changes with improved transitions
   * @param {string} position - New sheet position
   */
  handlePositionChange(position) {
    // Update document body with sheet position for reactive UI
    document.body.dataset.sheetPosition = position;

    // Adjust content based on sheet position
    if (position === 'closed') {
      // No action needed when closed
    } else if (position === 'docked') {
      // Show summary view
      this.renderSummaryView();
    } else if (position === 'half') {
      // Show detailed form
      this.renderDetailedForm();
    } else if (position === 'full') {
      // Show complete form with all options
      this.renderFullForm();
    }
  }

  /**
   * Handle input changes with validation
   * @param {HTMLElement} input - The input element that changed
   */
  handleInputChange(input) {
    console.log("Input changed:", input.name, input.value); // Added for debugging
    const name = input.name;
    let value = input.value;

    // Convert checkbox and radio values
    if (input.type === 'checkbox') {
      if (name === 'incomeSources') {
        // Handle array checkbox values specially
        this.handleCheckboxChange(input);
        return;
      } else {
        value = input.checked;
      }
    } else if (input.type === 'radio') {
      if (name === 'latePayments' || name === 'bankruptcy') {
        value = input.value === 'true';
      } else {
        value = input.value;
      }
    }

    // Update data model
    this.updateData(name, value);

    // Apply validation styles if needed
    this.validateField(input);

    // Update completion status
    this.updateCompletionStatus();
  }

  /**
   * Validate a form field
   * @param {HTMLElement} input - The input element to validate
   */
  validateField(input) {
    // Get form group
    const formGroup = input.closest('.form-group');
    if (!formGroup) return;

    // Check if input is empty for required fields
    if (input.required && input.value.trim() === '') {
      formGroup.classList.add('has-error');
      return false;
    }

    // Check for numeric validation
    if (input.type === 'number' && input.value !== '') {
      const value = parseFloat(input.value);
      if (isNaN(value) || value < 0) {
        formGroup.classList.add('has-error');
        return false;
      }
    }

    // Field is valid
    formGroup.classList.remove('has-error');
    formGroup.classList.add('is-valid');
    return true;
  }

  /**
   * Handle checkbox changes for array values
   * @param {HTMLElement} checkbox - The checkbox element that changed
   */
  handleCheckboxChange(checkbox) {
    const name = checkbox.name;
    const value = checkbox.value;
    const checked = checkbox.checked;

    // Handle array values (checkboxes)
    if (name === 'incomeSources') {
      if (!Array.isArray(this.data[name])) {
        this.data[name] = [];
      }

      if (checked) {
        // Add to array if not already present
        if (!this.data[name].includes(value)) {
          this.data[name].push(value);
        }
      } else {
        // Remove from array
        this.data[name] = this.data[name].filter(item => item !== value);
      }

      // Save data
      this.saveData();

      // Update completion status
      this.updateCompletionStatus();
    }
  }

  /**
   * Update completion status for sections and pages
   */
  updateCompletionStatus() {
    // Reset completion status
    this.completionStatus = {
      'goals-income': [false, false],
      'debt-housing': [false, false],
      'credit-assets': [false, false],
      'payment-medical': [false, false]
    };

    // Check completion status for each section/page

    // Home Purchase Goals
    if (this.data.targetHomePrice && this.data.downPayment) {
      this.completionStatus['goals-income'][0] = true;
    }

    // Income Snapshot
    if (this.data.monthlyIncome && this.data.incomeSources.length > 0 && this.data.incomeTrend) {
      this.completionStatus['goals-income'][1] = true;
    }

    // Debt Obligations
    if ((this.data.carPayment !== '' || this.data.creditCardMinimums !== '')) {
      this.completionStatus['debt-housing'][0] = true;
    }

    // Housing Costs
    if (this.data.currentHousingExpense !== '') {
      this.completionStatus['debt-housing'][1] = true;
    }

    // Credit Health
    if (this.data.creditScoreRange) {
      this.completionStatus['credit-assets'][0] = true;
    }

    // Financial Reserves
    if (this.data.liquidCash !== '') {
      this.completionStatus['credit-assets'][1] = true;
    }

    // Payment History
    if (this.data.latePayments !== undefined && this.data.bankruptcy !== undefined) {
      this.completionStatus['payment-medical'][0] = true;
    }

    // Medical & Collections Debt
    this.completionStatus['payment-medical'][1] = true; // Optional section
  }

  /**
   * Update data model with improved validation and formatting
   * @param {string} field - Field name
   * @param {any} value - Field value
   */
  updateData(field, value) {
    this.data[field] = value;

    // Handle special cases with improved calculations
    if (field === 'downPayment' && this.data.targetHomePrice) {
      const targetPrice = parseFloat(this.data.targetHomePrice);
      const downPayment = parseFloat(value);

      if (!isNaN(targetPrice) && !isNaN(downPayment) && targetPrice > 0) {
        const percent = (downPayment / targetPrice) * 100;
        this.data.downPaymentPercent = percent.toFixed(1);

        // Update display if needed
        const percentElement = document.getElementById('down-payment-percent');
        if (percentElement) {
          percentElement.textContent = `${this.data.downPaymentPercent}%`;

          // Add animation class to highlight the update
          percentElement.classList.remove('updated');
          // Trigger reflow to restart animation
          void percentElement.offsetWidth;
          percentElement.classList.add('updated');
        }
      }
    } else if (field === 'targetHomePrice' && this.data.downPayment) {
      const targetPrice = parseFloat(value);
      const downPayment = parseFloat(this.data.downPayment);

      if (!isNaN(targetPrice) && !isNaN(downPayment) && targetPrice > 0) {
        const percent = (downPayment / targetPrice) * 100;
        this.data.downPaymentPercent = percent.toFixed(1);

        // Update display if needed
        const percentElement = document.getElementById('down-payment-percent');
        if (percentElement) {
          percentElement.textContent = `${this.data.downPaymentPercent}%`;

          // Add animation class to highlight the update
          percentElement.classList.remove('updated');
          // Trigger reflow to restart animation
          void percentElement.offsetWidth;
          percentElement.classList.add('updated');
        }
      }
    }

    // Format currency values for display
    if (field.includes('Price') || field.includes('Payment') || field.includes('Income') ||
        field.includes('Debt') || field.includes('Cash') || field.includes('Investments')) {

      // Format as currency if it's a number
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        const formattedValue = this.formatCurrency(numValue);

        // Update display value if an input element exists
        const inputElement = document.getElementById(field);
        if (inputElement && inputElement.type === 'number') {
          // Don't change the input value, as it needs to remain a number
          // But we could update a display element if needed
        }
      }
    }

    // Save data to localStorage for persistence
    this.saveData();
  }

  /**
   * Format a number as currency
   * @param {number} value - Value to format
   * @returns {string} - Formatted currency string
   */
  formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * Save data to localStorage with error handling
   */
  saveData() {
    try {
      localStorage.setItem('mortgageData', JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving data:', e);
    }
  }

  /**
   * Load data from localStorage with error handling
   */
  loadData() {
    try {
      const savedData = localStorage.getItem('mortgageData');
      if (savedData) {
        this.data = JSON.parse(savedData);
      }
    } catch (e) {
      console.error('Error loading saved data:', e);
    }
  }

  /**
   * Go to next page with enhanced animations
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      // Apply transition animation
      // Apply fade-out transition (optional, can be handled by CSS if preferred)
      const content = this.sheetController.getContentElement();
      content.style.transition = 'opacity 0.15s ease-out';
      content.style.opacity = '0';

      // Change page after fade-out
      setTimeout(() => {
        this.currentPage++;
        this.renderCurrentSection(); // Renders new content

        // Fade in new content (handled by setContent or CSS)
        // No need for transform manipulation here
        content.style.transition = 'opacity 0.15s ease-in';
        content.style.opacity = '1';

        // Reset transition after animation completes
        setTimeout(() => {
          content.style.transition = '';
        }, 150);
      }, 150);
    }
  }

  /**
   * Go to previous page with enhanced animations
   */
  previousPage() {
    if (this.currentPage > 1) {
      // Apply transition animation
      // Apply fade-out transition (optional, can be handled by CSS if preferred)
      const content = this.sheetController.getContentElement();
      content.style.transition = 'opacity 0.15s ease-out';
      content.style.opacity = '0';

      // Change page after fade-out
      setTimeout(() => {
        this.currentPage--;
        this.renderCurrentSection(); // Renders new content

        // Fade in new content (handled by setContent or CSS)
        // No need for transform manipulation here
        content.style.transition = 'opacity 0.15s ease-in';
        content.style.opacity = '1';

        // Reset transition after animation completes
        setTimeout(() => {
          content.style.transition = '';
        }, 150);
      }, 150);
    }
  }

  /**
   * Change form section with enhanced animations
   * @param {string} section - Section ID
   */
  changeSection(section) {
    if (this.currentSection === section) {
      return;
    }

    // Calculate whether we're moving forward or backward
    const sections = ['goals-income', 'debt-housing', 'credit-assets', 'payment-medical'];
    const currentIndex = sections.indexOf(this.currentSection);
    const newIndex = sections.indexOf(section);
    const isForward = newIndex > currentIndex;

    // Apply transition animation
    // Apply fade-out transition (optional, can be handled by CSS if preferred)
    const content = this.sheetController.getContentElement();
    content.style.transition = 'opacity 0.2s ease-out';
    content.style.opacity = '0';

    // Change section after fade-out
    setTimeout(() => {
      this.currentSection = section;
      this.currentPage = 1;
      this.renderCurrentSection(); // Renders new content

      // Fade in new content (handled by setContent or CSS)
      // No need for transform manipulation here
      content.style.transition = 'opacity 0.2s ease-in';
      content.style.opacity = '1';

      // Reset transition after animation completes
      setTimeout(() => {
        content.style.transition = '';
      }, 200);
    }, 200);
  }

  /**
   * Render current section based on state
   */
  renderCurrentSection() {
    const position = this.sheetController.getPosition();

    if (position === 'docked') {
      this.renderSummaryView();
    } else if (position === 'half') {
      this.renderDetailedForm();
    } else if (position === 'full') {
      this.renderFullForm();
    }
  }

  /**
   * Render summary view for docked position with improved design
   */
  renderSummaryView() {
    // Create a simple summary of entered data
    const content = document.createElement('div');
    content.className = 'summary-view';

    // Add title with icon
    const title = document.createElement('h2');
    title.textContent = 'Mortgage DTI Calculator';
    content.appendChild(title);

    // Check if we have any data and show a progress summary
    let hasData = false;
    for (const key in this.data) {
      if (this.data[key] && (
          (Array.isArray(this.data[key]) && this.data[key].length > 0) ||
          (!Array.isArray(this.data[key]) && this.data[key] !== '')
        )) {
        hasData = true;
        break;
      }
    }

    if (hasData) {
      // Show a summary of completion status
      const summary = document.createElement('div');
      summary.className = 'completion-summary';

      // Count completed sections
      let completedSections = 0;
      let totalSections = 0;

      for (const section in this.completionStatus) {
        for (const pageStatus of this.completionStatus[section]) {
          if (pageStatus) completedSections++;
          totalSections++;
        }
      }

      // Calculate percentage
      const completionPercentage = Math.round((completedSections / totalSections) * 100);

      // Create progress ring
      summary.innerHTML = `
        <div class="progress-circle" style="--progress: ${completionPercentage}%">
          <div class="progress-circle-inner">
            <span class="progress-percentage">${completionPercentage}%</span>
            <span class="progress-label">Complete</span>
          </div>
        </div>
        <p>Continue filling in your information to calculate your DTI and affordability.</p>
      `;

      content.appendChild(summary);
    } else {
      // Add prompt to continue
      const prompt = document.createElement('p');
      prompt.textContent = 'Swipe up to enter your information';
      prompt.className = 'swipe-prompt';
      content.appendChild(prompt);
    }

    // Add button to expand
    const expandButton = document.createElement('button');
    expandButton.innerHTML = `
      <span>Enter Details</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    expandButton.className = 'expand-button button-with-icon';
    content.appendChild(expandButton);

    this.sheetController.setContent(content);
  }

  /**
   * Render detailed form for half position with improved design
   */
  renderDetailedForm() {
    // Main form view with page navigation
    const content = document.createElement('div');
    content.className = 'detailed-form';

    // Add progress indicator with improved design
    const progress = document.createElement('div');
    progress.className = 'progress-indicator';

    // Add current section name for context
    const sectionName = {
      'goals-income': 'Goals & Income',
      'debt-housing': 'Debt & Housing',
      'credit-assets': 'Credit & Assets',
      'payment-medical': 'Payment History'
    }[this.currentSection];

    progress.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${(this.currentPage / this.totalPages) * 100}%"></div>
      </div>
      <div class="progress-text">
        <span>${sectionName} - Step ${this.currentPage} of ${this.totalPages}</span>
        <span>${Math.round((this.currentPage / this.totalPages) * 100)}%</span>
      </div>
    `;
    content.appendChild(progress);

    // Add form content based on current page
    const formContent = this.getFormContent();
    content.appendChild(formContent);

    // Add navigation buttons with improved design
    const navigation = document.createElement('div');
    navigation.className = 'form-navigation';

    if (this.currentPage > 1) {
      const prevButton = document.createElement('button');
      prevButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>Previous</span>
      `;
      prevButton.className = 'prev-button button-with-icon';
      navigation.appendChild(prevButton);
    }

    if (this.currentPage < this.totalPages) {
      const nextButton = document.createElement('button');
      nextButton.innerHTML = `
        <span>Next</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
      nextButton.className = 'next-button button-with-icon';
      navigation.appendChild(nextButton);
    } else {
      const submitButton = document.createElement('button');
      submitButton.innerHTML = `
        <span>Calculate</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
          <polyline points="16 7 22 7 22 13"></polyline>
        </svg>
      `;
      submitButton.className = 'submit-button button-with-icon';
      navigation.appendChild(submitButton);
    }

    content.appendChild(navigation);

    this.sheetController.setContent(content);
  }

  /**
   * Render full form view for full position with improved design
   */
  renderFullForm() {
    // Full form view with all sections
    const content = document.createElement('div');
    content.className = 'full-form';

    // Add title with subtle animation
    const title = document.createElement('h2');
    title.textContent = 'Mortgage Information';
    title.className = 'fade-in-up';
    content.appendChild(title);

    // Add section navigation with improved design
    const sections = document.createElement('div');
    sections.className = 'section-navigation';

    const sectionsList = [
      { id: 'goals-income', name: 'Goals & Income', icon: 'target' },
      { id: 'debt-housing', name: 'Debt & Housing', icon: 'home' },
      { id: 'credit-assets', name: 'Credit & Assets', icon: 'credit-card' },
      { id: 'payment-medical', name: 'Payment History', icon: 'clock' }
    ];

    sectionsList.forEach(section => {
      const button = document.createElement('button');

      // Get completion status for this section
      const isComplete = this.completionStatus[section.id].every(status => status);

      // Add completion indicator
      button.innerHTML = `
        ${section.name}
        ${isComplete ? '<span class="completion-dot"></span>' : ''}
      `;

      button.className = `section-button ${this.currentSection === section.id ? 'active' : ''}`;
      if (isComplete) button.classList.add('completed');
      button.dataset.section = section.id;
      sections.appendChild(button);
    });

    content.appendChild(sections);

    // Add form content based on current section
    const formContent = this.getFormContent();
    content.appendChild(formContent);

    // Add calculate button with improved design
    const calculateButton = document.createElement('button');
    calculateButton.innerHTML = `
      <span>Calculate Maximum DTI</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
        <line x1="6" y1="1" x2="6" y2="4"></line>
        <line x1="10" y1="1" x2="10" y2="4"></line>
        <line x1="14" y1="1" x2="14" y2="4"></line>
      </svg>
    `;
    calculateButton.className = 'calculate-button button-with-icon';
    content.appendChild(calculateButton);

    this.sheetController.setContent(content);
  }

  /**
   * Get form content based on current section and page with enhanced design
   * @returns {HTMLElement} Form element
   */
  getFormContent() {
    // Generate form content based on current section and page
    const form = document.createElement('form');
    form.className = 'mortgage-form';
    form.setAttribute('novalidate', 'true'); // We'll handle validation ourselves

    if (this.currentSection === 'goals-income') {
      if (this.currentPage === 1) {
        // Home Purchase Goals
        form.innerHTML = `
          <div class="form-section">
            <h3>Home Purchase Goals</h3>

            <div class="form-group">
              <label for="targetHomePrice">Target Home Price</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="targetHomePrice"
                  name="targetHomePrice"
                  value="${this.data.targetHomePrice}"
                  placeholder="Enter amount"
                  required
                />
              </div>
              <p class="help-text">What's the estimated purchase price of your home?</p>
            </div>

            <div class="form-group">
              <label for="downPayment">Down Payment</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="downPayment"
                  name="downPayment"
                  value="${this.data.downPayment}"
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div class="percentage-display" id="down-payment-percent">
                ${this.data.downPaymentPercent ? `${this.data.downPaymentPercent}%` : ''}
              </div>
              <p class="help-text">How much do you plan to pay upfront?</p>
              <div class="tip-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Typical down payments range from 0–30%. Higher payments may lead to better loan terms.</span>
              </div>
            </div>
          </div>
        `;
      } else if (this.currentPage === 2) {
        // Income Snapshot
        form.innerHTML = `
          <div class="form-section">
            <h3>Income Snapshot</h3>

            <div class="form-group">
              <label for="monthlyIncome">Monthly Income</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="monthlyIncome"
                  name="monthlyIncome"
                  value="${this.data.monthlyIncome}"
                  placeholder="Enter monthly income"
                  required
                />
              </div>
              <p class="help-text">What is your total monthly income before taxes?</p>
            </div>

            <div class="form-group">
              <label>Income Sources</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    name="incomeSources"
                    value="Salary"
                    ${this.data.incomeSources?.includes('Salary') ? 'checked' : ''}
                  />
                  <span>Salary</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    name="incomeSources"
                    value="Hourly"
                    ${this.data.incomeSources?.includes('Hourly') ? 'checked' : ''}
                  />
                  <span>Hourly</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    name="incomeSources"
                    value="Overtime"
                    ${this.data.incomeSources?.includes('Overtime') ? 'checked' : ''}
                  />
                  <span>Overtime</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    name="incomeSources"
                    value="Tips"
                    ${this.data.incomeSources?.includes('Tips') ? 'checked' : ''}
                  />
                  <span>Tips</span>
                </label>
              </div>
              <p class="help-text">Which sources contribute to your income?</p>
            </div>

            <div class="form-group">
              <label>Income Trend</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="incomeTrend"
                    value="Increased"
                    ${this.data.incomeTrend === 'Increased' ? 'checked' : ''}
                  />
                  <span>Increased</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="incomeTrend"
                    value="Stable"
                    ${this.data.incomeTrend === 'Stable' ? 'checked' : ''}
                  />
                  <span>Stable</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="incomeTrend"
                    value="Decreased"
                    ${this.data.incomeTrend === 'Decreased' ? 'checked' : ''}
                  />
                  <span>Decreased</span>
                </label>
              </div>
              <p class="help-text">How has your income changed over the last 12 months?</p>
            </div>
          </div>
        `;
      }
    } else if (this.currentSection === 'debt-housing') {
      if (this.currentPage === 1) {
        // Debt Obligations
        form.innerHTML = `
          <div class="form-section">
            <h3>Debt Obligations</h3>

            <div class="form-group">
              <label for="carPayment">Car Payment</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="carPayment"
                  name="carPayment"
                  value="${this.data.carPayment}"
                  placeholder="Enter monthly payment"
                />
              </div>
              <p class="help-text">What is your monthly car payment? Enter 0 if none.</p>
            </div>

            <div class="form-group">
              <label for="creditCardMinimums">Credit Card Minimums</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="creditCardMinimums"
                  name="creditCardMinimums"
                  value="${this.data.creditCardMinimums}"
                  placeholder="Enter monthly minimum"
                />
              </div>
              <p class="help-text">What is the total minimum monthly payment on your credit cards?</p>
            </div>

            <div class="form-group">
              <label for="otherDebts">Other Debts</label>
              <textarea
                id="otherDebts"
                name="otherDebts"
                placeholder="List any additional monthly debts (e.g., student loans, alimony, child support, leases) and their amounts."
              >${this.data.otherDebts}</textarea>
              <p class="help-text">Include any other recurring monthly obligations.</p>
            </div>
          </div>
        `;
      } else if (this.currentPage === 2) {
        // Housing Costs
        form.innerHTML = `
          <div class="form-section">
            <h3>Housing Costs</h3>

            <div class="form-group">
              <label for="currentHousingExpense">Current Housing Expense</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="currentHousingExpense"
                  name="currentHousingExpense"
                  value="${this.data.currentHousingExpense}"
                  placeholder="Enter monthly amount"
                  required
                />
              </div>
              <p class="help-text">How much do you currently pay for housing (rent or mortgage) each month?</p>
            </div>

            <div class="form-group">
              <label for="residencyDuration">Residency Duration</label>
              <input
                type="text"
                id="residencyDuration"
                name="residencyDuration"
                value="${this.data.residencyDuration}"
                placeholder="e.g., 2 years, 6 months"
              />
              <p class="help-text">How long have you lived at your current address?</p>
              <div class="tip-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Longer residency at the same address typically demonstrates stability to lenders.</span>
              </div>
            </div>
          </div>
        `;
      }
    } else if (this.currentSection === 'credit-assets') {
      if (this.currentPage === 1) {
        // Credit Health
        form.innerHTML = `
          <div class="form-section">
            <h3>Credit Health</h3>

            <div class="form-group">
              <label>Credit Score Range</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="creditScoreRange"
                    value="Below 580"
                    ${this.data.creditScoreRange === 'Below 580' ? 'checked' : ''}
                  />
                  <span>Below 580</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="creditScoreRange"
                    value="580-600"
                    ${this.data.creditScoreRange === '580-600' ? 'checked' : ''}
                  />
                  <span>580-600</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="creditScoreRange"
                    value="600-620"
                    ${this.data.creditScoreRange === '600-620' ? 'checked' : ''}
                  />
                  <span>600-620</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="creditScoreRange"
                    value="Above 620"
                    ${this.data.creditScoreRange === 'Above 620' ? 'checked' : ''}
                  />
                  <span>Above 620</span>
                </label>
              </div>
              <p class="help-text">What is your estimated credit score range?</p>
              <div class="tip-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Higher credit scores typically qualify for better interest rates and higher DTI allowances.</span>
              </div>
            </div>
          </div>
        `;
      } else if (this.currentPage === 2) {
        // Financial Reserves
        form.innerHTML = `
          <div class="form-section">
            <h3>Financial Reserves</h3>

            <div class="form-group">
              <label for="liquidCash">Liquid Cash</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="liquidCash"
                  name="liquidCash"
                  value="${this.data.liquidCash}"
                  placeholder="Enter amount"
                  required
                />
              </div>
              <p class="help-text">How much cash do you have readily available (checking, savings)?</p>
            </div>

            <div class="form-group">
              <label for="retirementInvestments">Retirement & Investments</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="retirementInvestments"
                  name="retirementInvestments"
                  value="${this.data.retirementInvestments}"
                  placeholder="Enter total amount"
                />
              </div>
              <p class="help-text">What is the total amount in your retirement or investment accounts?</p>
            </div>

            <div class="form-group">
              <label for="otherLiquidAssets">Other Liquid Assets</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="otherLiquidAssets"
                  name="otherLiquidAssets"
                  value="${this.data.otherLiquidAssets}"
                  placeholder="Enter amount"
                />
              </div>
              <p class="help-text">Do you have additional liquid assets (e.g., CDs, bonds)?</p>
            </div>
          </div>
        `;
      }
    } else if (this.currentSection === 'payment-medical') {
      if (this.currentPage === 1) {
        // Payment History
        form.innerHTML = `
          <div class="form-section">
            <h3>Payment History</h3>

            <div class="form-group">
              <label>Late Payments</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="latePayments"
                    value="true"
                    ${this.data.latePayments === true ? 'checked' : ''}
                  />
                  <span>Yes</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="latePayments"
                    value="false"
                    ${this.data.latePayments === false ? 'checked' : ''}
                  />
                  <span>No</span>
                </label>
              </div>
              <p class="help-text">Have you had any payments over 30 days late in the last 24 months?</p>
            </div>

            <div class="form-group">
              <label>Recent Bankruptcies</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="bankruptcy"
                    value="true"
                    ${this.data.bankruptcy === true ? 'checked' : ''}
                  />
                  <span>Yes</span>
                </label>
                <label class="radio-label">
                  <input
                    type="radio"
                    name="bankruptcy"
                    value="false"
                    ${this.data.bankruptcy === false ? 'checked' : ''}
                  />
                  <span>No</span>
                </label>
              </div>
              <p class="help-text">Have you filed for bankruptcy in the past 2 years?</p>
            </div>
          </div>
        `;
      } else if (this.currentPage === 2) {
        // Medical & Collections Debt
        form.innerHTML = `
          <div class="form-section">
            <h3>Medical & Collections Debt</h3>

            <div class="form-group">
              <label for="medicalDebt">Outstanding Medical Debt</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="medicalDebt"
                  name="medicalDebt"
                  value="${this.data.medicalDebt}"
                  placeholder="Enter amount"
                />
              </div>
              <p class="help-text">Do you have any outstanding medical debts? Enter 0 if none.</p>
            </div>

            <div class="form-group">
              <label for="collectionsPayments">Collections Payments</label>
              <div class="input-with-prefix">
                <span class="prefix">$</span>
                <input
                  type="number"
                  id="collectionsPayments"
                  name="collectionsPayments"
                  value="${this.data.collectionsPayments}"
                  placeholder="Enter monthly total"
                />
              </div>
              <p class="help-text">Are you currently making payments on any collections accounts?</p>
            </div>
          </div>
        `;
      }
    }

    return form;
  }

  /**
   * Calculate DTI results with improved animation
   */
  calculateResults() {
    // Show loading state with animation
    this.showLoadingState();

    // Use setTimeout to give the UI time to update
    setTimeout(() => {
      // Calculate DTI
      const monthlyIncome = parseFloat(this.data.monthlyIncome) || 0;
      const carPayment = parseFloat(this.data.carPayment) || 0;
      const creditCardMinimums = parseFloat(this.data.creditCardMinimums) || 0;
      const currentHousingExpense = parseFloat(this.data.currentHousingExpense) || 0;
      const collectionsPayments = parseFloat(this.data.collectionsPayments) || 0;

      const totalDebt = carPayment + creditCardMinimums + currentHousingExpense + collectionsPayments;
      const dti = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 0;

      // Determine max DTI based on factors with enhanced algorithm
      let maxDti = 43; // Standard maximum
      let dtiFactors = [];

      // Adjust for credit score
      if (this.data.creditScoreRange === 'Above 620') {
        maxDti += 2;
        dtiFactors.push({ factor: 'Excellent credit score', effect: '+2%' });
      } else if (this.data.creditScoreRange === '600-620') {
        maxDti += 1;
        dtiFactors.push({ factor: 'Good credit score', effect: '+1%' });
      } else if (this.data.creditScoreRange === 'Below 580') {
        maxDti -= 5;
        dtiFactors.push({ factor: 'Lower credit score', effect: '-5%' });
      }

      // Adjust for mitigating factors
      const liquidCash = parseFloat(this.data.liquidCash) || 0;
      const targetHomePrice = parseFloat(this.data.targetHomePrice) || 0;

      // If liquid cash is more than 20% of home price, allow higher DTI
      if (targetHomePrice > 0 && (liquidCash / targetHomePrice) > 0.2) {
        maxDti += 2;
        dtiFactors.push({ factor: 'Strong cash reserves', effect: '+2%' });
      } else if (targetHomePrice > 0 && (liquidCash / targetHomePrice) > 0.1) {
        maxDti += 1;
        dtiFactors.push({ factor: 'Moderate cash reserves', effect: '+1%' });
      }

      // If income is increasing, allow higher DTI
      if (this.data.incomeTrend === 'Increased') {
        maxDti += 1;
        dtiFactors.push({ factor: 'Increasing income', effect: '+1%' });
      } else if (this.data.incomeTrend === 'Decreased') {
        maxDti -= 1;
        dtiFactors.push({ factor: 'Decreasing income', effect: '-1%' });
      }

      // If stable residency, allow higher DTI
      if (this.data.residencyDuration && this.data.residencyDuration.includes('year')) {
        const yearsMatch = this.data.residencyDuration.match(/(\d+)\s*year/);
        if (yearsMatch && parseInt(yearsMatch[1]) >= 2) {
          maxDti += 1;
          dtiFactors.push({ factor: 'Stable housing history', effect: '+1%' });
        }
      }

      // If recent bankruptcies, reduce DTI
      if (this.data.bankruptcy === true) {
        maxDti -= 3;
        dtiFactors.push({ factor: 'Recent bankruptcy', effect: '-3%' });
      }

      // If late payments, reduce DTI
      if (this.data.latePayments === true) {
        maxDti -= 2;
        dtiFactors.push({ factor: 'Recent late payments', effect: '-2%' });
      }

      // Ensure DTI doesn't go below minimum or above maximum
      maxDti = Math.max(33, Math.min(50, maxDti));

      // Calculate max monthly payment
      const nonHousingDebt = carPayment + creditCardMinimums + collectionsPayments;
      const maxMonthlyPayment = (monthlyIncome * (maxDti / 100)) - nonHousingDebt;

      // Store calculated values and factors
      this.calculatedDti = dti;
      this.calculatedMaxDti = maxDti;
      this.calculatedMaxMonthlyPayment = maxMonthlyPayment;
      this.dtiFactors = dtiFactors;

      // Show results
      this.showResults(dti, maxDti, dtiFactors);
    }, 1200); // Slightly longer calculation time for effect
  }

  /**
   * Show loading state while calculating with improved animation
   */
  showLoadingState() {
    const content = document.createElement('div');
    content.className = 'loading-view';

    content.innerHTML = `
      <div class="loading"></div>
      <p>Calculating your DTI ratio...</p>
    `;

    this.sheetController.setContent(content);
  }

  /**
   * Show calculation results with improved design and animations
   * @param {number} dti - Calculated DTI
   * @param {number} maxDti - Maximum DTI
   * @param {Array} dtiFactors - Factors affecting DTI
   */
  showResults(dti, maxDti, dtiFactors) {
    // Create results view
    const content = document.createElement('div');
    content.className = 'results-view';

    // Add title
    const title = document.createElement('h2');
    title.textContent = 'DTI Analysis Results';
    content.appendChild(title);

    // Add DTI information with improved visualization
    const dtiInfo = document.createElement('div');
    dtiInfo.className = 'dti-info';

    // Create a visual indicator for DTI status
    const dtiStatus = dti <= maxDti ? 'positive' : 'negative';
    const statusClass = dtiStatus === 'positive' ? 'status-positive' : 'status-negative';

    const currentDti = document.createElement('div');
    currentDti.className = `dti-card ${statusClass}`;
    currentDti.innerHTML = `
      <h3>Current DTI</h3>
      <div class="dti-value">${dti.toFixed(1)}%</div>
      <p class="status-text">${dtiStatus === 'positive' ? 'Within acceptable range' : 'Exceeds maximum'}</p>
    `;
    dtiInfo.appendChild(currentDti);

    const maxDtiCard = document.createElement('div');
    maxDtiCard.className = 'dti-card';
    maxDtiCard.innerHTML = `
      <h3>Maximum DTI</h3>
      <div class="dti-value">${maxDti.toFixed(1)}%</div>
      <p class="status-text">Based on your profile</p>
    `;
    dtiInfo.appendChild(maxDtiCard);

    content.appendChild(dtiInfo);

    // Add explanation with factor breakdown
    const explanation = document.createElement('div');
    explanation.className = 'results-explanation';

    let factorsHtml = '';
    if (dtiFactors && dtiFactors.length > 0) {
      factorsHtml = `
        <p>Your maximum DTI was calculated based on these factors:</p>
        <ul class="factors-list">
          ${dtiFactors.map(factor => `
            <li>
              <span class="factor-name">${factor.factor}</span>
              <span class="factor-effect ${factor.effect.includes('+') ? 'positive' : 'negative'}">${factor.effect}</span>
            </li>
          `).join('')}
        </ul>
      `;
    }

    explanation.innerHTML = `
      <p>Your debt-to-income ratio (DTI) is the percentage of your monthly income that goes toward paying debts.</p>
      ${factorsHtml}
    `;
    content.appendChild(explanation);

    // Add next steps with improved design
    const nextSteps = document.createElement('div');
    nextSteps.className = 'next-steps';
    nextSteps.innerHTML = `
      <h3>Next Steps</h3>
      <p>With your DTI information, you can now:</p>
      <button class="view-affordability-button">
        <span>Calculate Affordability</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      </button>
      <button class="edit-info-button">
        <span>Edit Your Information</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    `;
    content.appendChild(nextSteps);

    this.sheetController.setContent(content);
    this.sheetController.setPosition('full');
  }

  /**
   * Show affordability calculation with improved design
   * @param {number} maxDti - Maximum DTI
   */
  showAffordability(maxDti) {
    // Calculate affordability based on DTI with improved algorithm
    const monthlyIncome = parseFloat(this.data.monthlyIncome) || 0;
    const carPayment = parseFloat(this.data.carPayment) || 0;
    const creditCardMinimums = parseFloat(this.data.creditCardMinimums) || 0;
    const collectionsPayments = parseFloat(this.data.collectionsPayments) || 0;

    const nonHousingDebt = carPayment + creditCardMinimums + collectionsPayments;
    const maxMonthlyPayment = (monthlyIncome * (maxDti / 100)) - nonHousingDebt;

    // Store the calculated max monthly payment
    this.calculatedMaxMonthlyPayment = maxMonthlyPayment;

    // Calculate estimated home price range based on payment
    const interestRate = 6.5; // Estimated current mortgage rate
    const years = 30; // Standard loan term
    const monthlyRate = interestRate / 100 / 12;
    const payments = years * 12;

    // Estimate monthly taxes, insurance, and PMI as percentage of loan
    const taxesAndInsurance = monthlyIncome * 0.05; // Estimated at 5% of monthly income

    // Calculate loan amount using payment minus taxes/insurance
    const paymentForPrincipalAndInterest = Math.max(0, maxMonthlyPayment - taxesAndInsurance);

    // Use mortgage formula: P = L[c(1 + c)^n]/[(1 + c)^n - 1]
    // Solved for L (loan amount): L = P[((1 + c)^n - 1)]/[c(1 + c)^n]
    let estimatedPrice = 0;
    if (paymentForPrincipalAndInterest > 0) {
      const numerator = (Math.pow(1 + monthlyRate, payments) - 1);
      const denominator = monthlyRate * Math.pow(1 + monthlyRate, payments);
      const loanAmount = paymentForPrincipalAndInterest * (numerator / denominator);

      // Assuming 20% down payment
      estimatedPrice = loanAmount / 0.8;
    }

    // Create affordability view
    const content = document.createElement('div');
    content.className = 'affordability-view';

    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Affordability Analysis';
    content.appendChild(title);

    // Add affordability information with improved visualization
    const affordabilityInfo = document.createElement('div');
    affordabilityInfo.className = 'affordability-info';

    affordabilityInfo.innerHTML = `
      <div class="affordability-card">
        <h3>Maximum Monthly Payment</h3>
        <div class="affordability-value">$${maxMonthlyPayment.toFixed(0)}</div>
        <p class="help-text">Based on your maximum DTI of ${maxDti.toFixed(1)}%</p>
      </div>

      <div class="affordability-card">
        <h3>Estimated Home Price</h3>
        <div class="affordability-value">$${estimatedPrice.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</div>
        <p class="help-text">Based on current rates and 20% down</p>
      </div>
    `;
    content.appendChild(affordabilityInfo);

    // Add explanation with improved breakdown
    const explanation = document.createElement('div');
    explanation.className = 'affordability-explanation';
    explanation.innerHTML = `
      <p>Your estimated maximum monthly mortgage payment includes:</p>
      <ul>
        <li>Principal and Interest: ~$${paymentForPrincipalAndInterest.toFixed(0)}</li>
        <li>Taxes and Insurance: ~$${taxesAndInsurance.toFixed(0)}</li>
      </ul>
      <p>This is based on a 30-year fixed mortgage at an estimated rate of ${interestRate}%.</p>
    `;
    content.appendChild(explanation);

    // Add back button with icon
    const backButton = document.createElement('button');
    backButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      <span>Back to Results</span>
    `;
    backButton.className = 'back-button button-with-icon';
    content.appendChild(backButton);

    this.sheetController.setContent(content);
  }
}
<environment_details>
# VSCode Visible Files
prototype/mortgage-data-collection.js

# VSCode Open Tabs
prototype/sheet-physics.js
prototype/sheet-controller.js
prototype/mortgage-data-collection.js

# Current Time
3/31/2025, 5:52:01 PM (America/Denver, UTC-6:00)

# Current Mode
ACT MODE
</environment_details>
<environment_details>
# VSCode Visible Files
prototype/styles.css

# VSCode Open Tabs
prototype/sheet-physics.js
prototype/mortgage-data-collection.js
prototype/sheet-controller.js
prototype/styles.css

# Current Time
3/31/2025, 6:05:06 PM (America/Denver, UTC-6:00)

# Current Mode
ACT MODE
</environment_details>
