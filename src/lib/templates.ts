// Template definitions — web version using Lucide icon names

export const CATEGORIES = [
  { id: 'blank',        icon: 'plus',           color: '#10B981', name: 'Blank Register' },
  { id: 'property',     icon: 'building',      color: '#3B82F6', name: 'Property' },
  { id: 'school',       icon: 'graduation-cap', color: '#10B981', name: 'School' },
  { id: 'shop',         icon: 'store',          color: '#F59E0B', name: 'Shop' },
  { id: 'transport',    icon: 'bus',            color: '#6366F1', name: 'Transport' },
  { id: 'wholesaler',   icon: 'warehouse',      color: '#8B5CF6', name: 'Whole Saler' },
  { id: 'distributors', icon: 'package',        color: '#EC4899', name: 'Distributors' },
  { id: 'event',        icon: 'calendar',       color: '#EF4444', name: 'Event Management' },
  { id: 'hospitals',    icon: 'heart-pulse',    color: '#14B8A6', name: 'Hospitals' },
  { id: 'restaurant',   icon: 'utensils',       color: '#F97316', name: 'Restaurant Canteen' },
  { id: 'fitness',      icon: 'dumbbell',       color: '#06B6D4', name: 'Health Fitness' },
  { id: 'apartment',    icon: 'building-2',     color: '#64748B', name: 'Apartment' },
  { id: 'student',      icon: 'user',           color: '#0284C7', name: 'Student' },
  { id: 'insurance',    icon: 'shield-check',   color: '#059669', name: 'Insurance Agent' },
  { id: 'farming',      icon: 'leaf',           color: '#84CC16', name: 'Farming' },
  { id: 'travel',       icon: 'plane',          color: '#D946EF', name: 'Travel' },
];

export interface TemplateColumn {
  name: string;
  type: string;
  formula?: string;
  dropdownOptions?: string[];
}

export const DEFAULT_BLANK_COLUMNS: TemplateColumn[] = [
  { name: 'Column 1', type: 'text' },
  { name: 'Column 2', type: 'text' },
  { name: 'Column 3', type: 'text' },
  { name: 'Column 4', type: 'text' },
  { name: 'Column 5', type: 'text' },
  { name: 'Column 6', type: 'text' },
];

export interface Template {
  name: string;
  columns: TemplateColumn[];
  icon: string;
  description: string;
}

export const TEMPLATES: Record<string, Template[]> = {

  // ─── Student ──────────────────────────────────────────────────
  student: [
    {
      name: 'Test Marks History',
      icon: 'file-text',
      description: 'Track test scores with auto-calculated percentage',
      columns: [
        { name: 'Date',          type: 'date' },
        { name: 'Topic',         type: 'text' },
        { name: 'Full Marks',    type: 'number' },
        { name: 'Marks Obtained',type: 'number' },
        { name: 'Percentage',    type: 'formula', formula: '{Marks Obtained}/{Full Marks}*100' },
        { name: 'Remarks',       type: 'text' },
      ],
    },
    {
      name: 'Syllabus Tracking',
      icon: 'library',
      description: 'Track syllabus completion status',
      columns: [
        { name: 'Topic',    type: 'text' },
        { name: 'Chapter',  type: 'text' },
        { name: 'Status',   type: 'dropdown', dropdownOptions: ['Not Started', 'In Progress', 'Completed', 'Revision'] },
        { name: 'Deadline', type: 'date' },
      ],
    },
    {
      name: 'Exam Schedule',
      icon: 'calendar',
      description: 'Upcoming exam dates and venues',
      columns: [
        { name: 'Exam',   type: 'text' },
        { name: 'Date',   type: 'date' },
        { name: 'Time',   type: 'text' },
        { name: 'Venue',  type: 'text' },
        { name: 'Status', type: 'dropdown', dropdownOptions: ['Upcoming', 'Completed', 'Cancelled'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── School ───────────────────────────────────────────────────
  school: [
    {
      name: 'Admission Register',
      icon: 'users',
      description: 'Student admissions with family and class details',
      columns: [
        { name: 'Date',         type: 'date' },
        { name: 'Old / New',    type: 'dropdown', dropdownOptions: ['OLD', 'NEW'] },
        { name: 'Sib Stu',      type: 'checkbox' },
        { name: 'DOB',          type: 'date' },
        { name: 'Name',         type: 'text' },
        { name: 'Parent Name',  type: 'text' },
        { name: 'Class',        type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
      ],
    },
    {
      name: 'Attendance Register',
      icon: 'check-circle',
      description: 'Daily student attendance tracking',
      columns: [
        { name: 'Student Name', type: 'text' },
        { name: 'Roll No',      type: 'text' },
        { name: 'Date',         type: 'date' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Present', 'Absent', 'Late', 'Leave'] },
        { name: 'Remarks',      type: 'text' },
      ],
    },
    {
      name: 'Fee Collection',
      icon: 'banknote',
      description: 'Student fees with auto-calculated balance',
      columns: [
        { name: 'Student Name', type: 'text' },
        { name: 'Class',        type: 'dropdown', dropdownOptions: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
        { name: 'Total Fees',   type: 'number' },
        { name: 'Amount Paid',  type: 'number' },
        { name: 'Balance',      type: 'formula', formula: '{Total Fees}-{Amount Paid}' },
        { name: 'Paid Date',    type: 'date' },
        { name: 'Receipt No',   type: 'text' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Paid', 'Partial', 'Pending', 'Overdue'] },
      ],
    },
    {
      name: 'Exam Results',
      icon: 'trending-up',
      description: 'Student marks with auto-calculated percentage',
      columns: [
        { name: 'Student Name',  type: 'text' },
        { name: 'Roll No',       type: 'text' },
        { name: 'Subject',       type: 'text' },
        { name: 'Full Marks',    type: 'number' },
        { name: 'Marks Obtained',type: 'number' },
        { name: 'Percentage',    type: 'formula', formula: '{Marks Obtained}/{Full Marks}*100' },
        { name: 'Grade',         type: 'dropdown', dropdownOptions: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'] },
      ],
    },
    {
      name: 'Staff Salary',
      icon: 'banknote',
      description: 'Staff salaries with auto-calculated net pay',
      columns: [
        { name: 'Employee Name', type: 'text' },
        { name: 'Role',         type: 'dropdown', dropdownOptions: ['Teacher', 'Staff', 'Admin', 'Peon', 'Driver', 'Other'] },
        { name: 'Month',        type: 'text' },
        { name: 'Basic Pay',    type: 'number' },
        { name: 'Allowances',   type: 'number' },
        { name: 'Deductions',   type: 'number' },
        { name: 'Net Pay',      type: 'formula', formula: '{Basic Pay}+{Allowances}-{Deductions}' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Paid', 'Pending'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Property ─────────────────────────────────────────────────
  property: [
    {
      name: 'Property Listing',
      icon: 'building',
      description: 'List of properties and their status',
      columns: [
        { name: 'Property Name', type: 'text' },
        { name: 'Location',      type: 'text' },
        { name: 'Type',          type: 'dropdown', dropdownOptions: ['Residential', 'Commercial', 'Industrial', 'Land', 'Plot'] },
        { name: 'Price',         type: 'number' },
        { name: 'Status',        type: 'dropdown', dropdownOptions: ['Available', 'Sold', 'Rented', 'Under Negotiation'] },
        { name: 'Remarks',       type: 'text' },
      ],
    },
    {
      name: 'Rent Collection',
      icon: 'banknote',
      description: 'Track monthly rent payments',
      columns: [
        { name: 'Tenant',       type: 'text' },
        { name: 'Property',     type: 'text' },
        { name: 'Monthly Rent', type: 'number' },
        { name: 'Paid Date',    type: 'date' },
        { name: 'Receipt No',   type: 'text' },
        { name: 'Balance',      type: 'number' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Paid', 'Partial', 'Pending', 'Overdue'] },
      ],
    },
    {
      name: 'Maintenance Log',
      icon: 'wrench',
      description: 'Property maintenance and repair records',
      columns: [
        { name: 'Date',     type: 'date' },
        { name: 'Issue',    type: 'text' },
        { name: 'Property', type: 'text' },
        { name: 'Status',   type: 'dropdown', dropdownOptions: ['Open', 'In Progress', 'Resolved', 'Cancelled'] },
        { name: 'Cost',     type: 'number' },
        { name: 'Remarks',  type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Shop ─────────────────────────────────────────────────────
  shop: [
    {
      name: 'Inventory',
      icon: 'package',
      description: 'Stock levels and item tracking',
      columns: [
        { name: 'Item Name',     type: 'text' },
        { name: 'SKU',           type: 'text' },
        { name: 'Quantity',      type: 'number' },
        { name: 'Unit Price',    type: 'number' },
        { name: 'Reorder Level', type: 'number' },
        { name: 'Supplier',      type: 'text' },
      ],
    },
    {
      name: 'Sales Register',
      icon: 'shopping-cart',
      description: 'Daily sales with auto-calculated total',
      columns: [
        { name: 'Date',         type: 'date' },
        { name: 'Item',         type: 'text' },
        { name: 'Qty Sold',     type: 'number' },
        { name: 'Rate',         type: 'number' },
        { name: 'Total',        type: 'formula', formula: '{Qty Sold}*{Rate}' },
        { name: 'Payment Mode', type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },
      ],
    },
    {
      name: 'Customer Ledger',
      icon: 'book',
      description: 'Customer account balance tracking',
      columns: [
        { name: 'Customer Name', type: 'text' },
        { name: 'Date',          type: 'date' },
        { name: 'Debit',         type: 'number' },
        { name: 'Credit',        type: 'number' },
        { name: 'Balance',       type: 'number' },
        { name: 'Remarks',       type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Transport ────────────────────────────────────────────────
  transport: [
    {
      name: 'Vehicle Log',
      icon: 'bus',
      description: 'Trip and driver logs',
      columns: [
        { name: 'Vehicle No', type: 'text' },
        { name: 'Driver',     type: 'text' },
        { name: 'From',       type: 'text' },
        { name: 'To',         type: 'text' },
        { name: 'KM Driven',  type: 'number' },
        { name: 'Date',       type: 'date' },
        { name: 'Remarks',    type: 'text' },
      ],
    },
    {
      name: 'Fuel Register',
      icon: 'fuel',
      description: 'Fuel expenses with auto-calculated cost',
      columns: [
        { name: 'Date',       type: 'date' },
        { name: 'Vehicle No', type: 'text' },
        { name: 'Liters',     type: 'number' },
        { name: 'Cost/Liter', type: 'number' },
        { name: 'Total Cost', type: 'formula', formula: '{Liters}*{Cost/Liter}' },
        { name: 'KM Reading', type: 'number' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Hospitals ────────────────────────────────────────────────
  hospitals: [
    {
      name: 'Patient Register',
      icon: 'bed-single',
      description: 'Patient admission and discharge records',
      columns: [
        { name: 'Name',      type: 'text' },
        { name: 'Age',       type: 'number' },
        { name: 'Gender',    type: 'dropdown', dropdownOptions: ['Male', 'Female', 'Other'] },
        { name: 'Diagnosis', type: 'text' },
        { name: 'Doctor',    type: 'text' },
        { name: 'Admission', type: 'date' },
        { name: 'Discharge', type: 'date' },
        { name: 'Status',    type: 'dropdown', dropdownOptions: ['Admitted', 'Discharged', 'Critical', 'Under Observation'] },
      ],
    },
    {
      name: 'Medicine Stock',
      icon: 'pill',
      description: 'Pharmacy inventory tracking',
      columns: [
        { name: 'Medicine',   type: 'text' },
        { name: 'Batch No',   type: 'text' },
        { name: 'Qty',        type: 'number' },
        { name: 'Expiry',     type: 'date' },
        { name: 'Unit Price', type: 'number' },
        { name: 'Supplier',   type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Distributors ─────────────────────────────────────────────
  distributors: [
    {
      name: 'Product Ledger',
      icon: 'package',
      description: 'Product dispatch records',
      columns: [
        { name: 'Product Name',   type: 'text' },
        { name: 'SKU',            type: 'text' },
        { name: 'Qty Dispatched', type: 'number' },
        { name: 'Customer',       type: 'text' },
        { name: 'Date',           type: 'date' },
        { name: 'Invoice No',     type: 'text' },
        { name: 'Status',         type: 'dropdown', dropdownOptions: ['Dispatched', 'Delivered', 'Returned'] },
      ],
    },
    {
      name: 'Payment Tracker',
      icon: 'credit-card',
      description: 'Customer payment collection with balance',
      columns: [
        { name: 'Customer',   type: 'text' },
        { name: 'Invoice No', type: 'text' },
        { name: 'Amount',     type: 'number' },
        { name: 'Paid',       type: 'number' },
        { name: 'Balance',    type: 'formula', formula: '{Amount}-{Paid}' },
        { name: 'Date',       type: 'date' },
        { name: 'Status',     type: 'dropdown', dropdownOptions: ['Pending', 'Partial', 'Cleared'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Event Management ─────────────────────────────────────────
  event: [
    {
      name: 'Guest List',
      icon: 'users',
      description: 'Event attendee and RSVP tracking',
      columns: [
        { name: 'Name',      type: 'text' },
        { name: 'RSVP',      type: 'dropdown', dropdownOptions: ['Confirmed', 'Pending', 'Declined'] },
        { name: 'Seats',     type: 'number' },
        { name: 'Meal Pref', type: 'dropdown', dropdownOptions: ['Veg', 'Non-Veg', 'Vegan', 'No Preference'] },
        { name: 'Notes',     type: 'text' },
      ],
    },
    {
      name: 'Vendor Log',
      icon: 'shield-check',
      description: 'Event vendor and service tracking',
      columns: [
        { name: 'Vendor',   type: 'text' },
        { name: 'Service',  type: 'text' },
        { name: 'Amount',   type: 'number' },
        { name: 'Paid',     type: 'number' },
        { name: 'Balance',  type: 'formula', formula: '{Amount}-{Paid}' },
        { name: 'Status',   type: 'dropdown', dropdownOptions: ['Booked', 'Confirmed', 'Paid', 'Cancelled'] },
      ],
    },
    {
      name: 'Expense Tracker',
      icon: 'receipt',
      description: 'Event-wise expense breakdown',
      columns: [
        { name: 'Date',     type: 'date' },
        { name: 'Category', type: 'dropdown', dropdownOptions: ['Venue', 'Catering', 'Decoration', 'Music', 'Photography', 'Transport', 'Other'] },
        { name: 'Details',  type: 'text' },
        { name: 'Amount',   type: 'number' },
        { name: 'Paid By',  type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Restaurant / Canteen ─────────────────────────────────────
  restaurant: [
    {
      name: 'Daily Menu',
      icon: 'utensils',
      description: 'Menu items and availability',
      columns: [
        { name: 'Item',      type: 'text' },
        { name: 'Category',  type: 'dropdown', dropdownOptions: ['Starter', 'Main Course', 'Dessert', 'Beverages', 'Snacks'] },
        { name: 'Price',     type: 'number' },
        { name: 'Available', type: 'dropdown', dropdownOptions: ['Yes', 'No', 'Limited'] },
        { name: 'Qty Made',  type: 'number' },
      ],
    },
    {
      name: 'Order Log',
      icon: 'file-text',
      description: 'Customer orders with auto-calculated total',
      columns: [
        { name: 'Table/Name',    type: 'text' },
        { name: 'Item',          type: 'text' },
        { name: 'Qty',           type: 'number' },
        { name: 'Rate',          type: 'number' },
        { name: 'Total',         type: 'formula', formula: '{Qty}*{Rate}' },
        { name: 'Payment Mode',  type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Health & Fitness ─────────────────────────────────────────
  fitness: [
    {
      name: 'Member Register',
      icon: 'dumbbell',
      description: 'Gym member list and plan details',
      columns: [
        { name: 'Name',       type: 'text' },
        { name: 'Plan',       type: 'dropdown', dropdownOptions: ['Monthly', 'Quarterly', 'Half-Yearly', 'Annual'] },
        { name: 'Start Date', type: 'date' },
        { name: 'End Date',   type: 'date' },
        { name: 'Status',     type: 'dropdown', dropdownOptions: ['Active', 'Expired', 'Paused'] },
      ],
    },
    {
      name: 'Fee Collection',
      icon: 'banknote',
      description: 'Membership fee records',
      columns: [
        { name: 'Member',    type: 'text' },
        { name: 'Month',     type: 'text' },
        { name: 'Amount',    type: 'number' },
        { name: 'Paid Date', type: 'date' },
        { name: 'Receipt',   type: 'text' },
        { name: 'Balance',   type: 'number' },
        { name: 'Status',    type: 'dropdown', dropdownOptions: ['Paid', 'Pending', 'Overdue'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Apartment ────────────────────────────────────────────────
  apartment: [
    {
      name: 'Flat Register',
      icon: 'building-2',
      description: 'Resident and flat occupancy list',
      columns: [
        { name: 'Flat No', type: 'text' },
        { name: 'Owner',   type: 'text' },
        { name: 'Tenant',  type: 'text' },
        { name: 'Floor',   type: 'text' },
        { name: 'Status',  type: 'dropdown', dropdownOptions: ['Owner Occupied', 'Rented', 'Vacant'] },
      ],
    },
    {
      name: 'Maintenance Fees',
      icon: 'wrench',
      description: 'Monthly maintenance fee collection',
      columns: [
        { name: 'Flat No',   type: 'text' },
        { name: 'Month',     type: 'text' },
        { name: 'Amount',    type: 'number' },
        { name: 'Paid Date', type: 'date' },
        { name: 'Receipt',   type: 'text' },
        { name: 'Balance',   type: 'number' },
        { name: 'Status',    type: 'dropdown', dropdownOptions: ['Paid', 'Pending', 'Overdue'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Insurance Agent ──────────────────────────────────────────
  insurance: [
    {
      name: 'Client Register',
      icon: 'users',
      description: 'Policy holder and premium tracking',
      columns: [
        { name: 'Name',      type: 'text' },
        { name: 'Policy No', type: 'text' },
        { name: 'Type',      type: 'dropdown', dropdownOptions: ['Life', 'Health', 'Vehicle', 'Property', 'Other'] },
        { name: 'Premium',   type: 'number' },
        { name: 'Due Date',  type: 'date' },
        { name: 'Status',    type: 'dropdown', dropdownOptions: ['Active', 'Lapsed', 'Expired', 'Claimed'] },
      ],
    },
    {
      name: 'Claim Register',
      icon: 'file',
      description: 'Insurance claims and settlement status',
      columns: [
        { name: 'Client',      type: 'text' },
        { name: 'Policy No',   type: 'text' },
        { name: 'Claim Date',  type: 'date' },
        { name: 'Amount',      type: 'number' },
        { name: 'Status',      type: 'dropdown', dropdownOptions: ['Filed', 'Under Review', 'Approved', 'Rejected', 'Settled'] },
        { name: 'Remarks',     type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Farming ──────────────────────────────────────────────────
  farming: [
    {
      name: 'Crop Register',
      icon: 'leaf',
      description: 'Crop planting and harvest tracking',
      columns: [
        { name: 'Crop',         type: 'text' },
        { name: 'Field',        type: 'text' },
        { name: 'Area (Acres)', type: 'number' },
        { name: 'Sown Date',    type: 'date' },
        { name: 'Harvest Date', type: 'date' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Sowing', 'Growing', 'Ready', 'Harvested'] },
        { name: 'Remarks',      type: 'text' },
      ],
    },
    {
      name: 'Expense Log',
      icon: 'receipt',
      description: 'Farm expenses by category',
      columns: [
        { name: 'Date',     type: 'date' },
        { name: 'Category', type: 'dropdown', dropdownOptions: ['Seeds', 'Fertilizer', 'Pesticide', 'Labour', 'Equipment', 'Transport', 'Other'] },
        { name: 'Crop',     type: 'text' },
        { name: 'Amount',   type: 'number' },
        { name: 'Notes',    type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Travel ───────────────────────────────────────────────────
  travel: [
    {
      name: 'Booking Register',
      icon: 'plane',
      description: 'Travel bookings and payment status',
      columns: [
        { name: 'Client',       type: 'text' },
        { name: 'Destination',  type: 'text' },
        { name: 'Travel Date',  type: 'date' },
        { name: 'Return Date',  type: 'date' },
        { name: 'Amount',       type: 'number' },
        { name: 'Status',       type: 'dropdown', dropdownOptions: ['Enquiry', 'Confirmed', 'Completed', 'Cancelled'] },
      ],
    },
    {
      name: 'Itinerary',
      icon: 'map',
      description: 'Day-wise trip schedule',
      columns: [
        { name: 'Day',      type: 'text' },
        { name: 'Date',     type: 'date' },
        { name: 'Activity', type: 'text' },
        { name: 'Location', type: 'text' },
        { name: 'Time',     type: 'text' },
        { name: 'Notes',    type: 'text' },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

  // ─── Wholesaler ───────────────────────────────────────────────
  wholesaler: [
    {
      name: 'Stock Register',
      icon: 'package',
      description: 'Wholesale inventory tracking',
      columns: [
        { name: 'Item',     type: 'text' },
        { name: 'Category', type: 'text' },
        { name: 'Qty',      type: 'number' },
        { name: 'Unit',     type: 'text' },
        { name: 'Rate',     type: 'number' },
        { name: 'Supplier', type: 'text' },
      ],
    },
    {
      name: 'Sales Log',
      icon: 'trending-up',
      description: 'Wholesale orders with auto-calculated total',
      columns: [
        { name: 'Date',         type: 'date' },
        { name: 'Customer',     type: 'text' },
        { name: 'Item',         type: 'text' },
        { name: 'Qty',          type: 'number' },
        { name: 'Rate',         type: 'number' },
        { name: 'Total',        type: 'formula', formula: '{Qty}*{Rate}' },
        { name: 'Payment Mode', type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },
      ],
    },
    { name: 'Blank Register', columns: DEFAULT_BLANK_COLUMNS, icon: 'file', description: 'Start from scratch' },
  ],

};
