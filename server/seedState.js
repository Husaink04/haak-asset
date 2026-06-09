export const seedState = {
  assetCategories: ["Laptop", "Printer"],
  credentialRequests: [],
  engineers: [],
  users: [
    { id: "u-admin", name: "HAAK Admin", email: "admin@haakinfotech.com", password: "admin123", role: "admin" },
    { id: "u-client", name: "Client Manager", email: "client@example.com", password: "client123", role: "client", clientId: "c-1" }
  ],
  clients: [
    {
      id: "c-1",
      companyName: "Apex Manufacturing Pvt Ltd",
      contactPerson: "Client Manager",
      email: "client@example.com",
      phone: "+91 98765 43210",
      address: "Coimbatore, Tamil Nadu",
      logoUrl: "",
      status: "active"
    }
  ],
  assets: [
    {
      id: "a-1",
      assetCode: "HAAK-LAP-001",
      clientId: "c-1",
      name: "Dell Latitude 5440",
      category: "Laptop",
      brand: "Dell",
      model: "Latitude 5440",
      serialNumber: "DL-5440-IN-104",
      purchaseDate: "2025-09-12",
      warrantyEndDate: "2028-09-11",
      location: "Finance Department",
      status: "active",
      notes: "Assigned to finance lead. Includes charger and docking station.",
      images: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"],
      documents: ["Invoice INV-2025-241", "Warranty Certificate"],
      lifecycle: [
        { id: "l-1", type: "Purchased", description: "Asset purchased by HAAK INFOTECH.", createdAt: "2025-09-12" },
        { id: "l-2", type: "Assigned", description: "Assigned to Apex Manufacturing.", createdAt: "2025-09-14" }
      ]
    },
    {
      id: "a-2",
      assetCode: "HAAK-PRN-004",
      clientId: "c-1",
      name: "HP LaserJet Pro",
      category: "Printer",
      brand: "HP",
      model: "M404dn",
      serialNumber: "HP-M404-8821",
      purchaseDate: "2024-04-03",
      warrantyEndDate: "2027-04-02",
      location: "Admin Office",
      status: "in_service",
      notes: "Paper feed roller replacement scheduled.",
      images: ["https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=80"],
      documents: ["Service Manual"],
      lifecycle: [
        { id: "l-3", type: "Purchased", description: "Printer purchased and tagged.", createdAt: "2024-04-03" },
        { id: "l-4", type: "Service", description: "Moved to in-service state.", createdAt: "2026-05-24" }
      ]
    }
  ],
  serviceRecords: [
    {
      id: "s-1",
      assetId: "a-1",
      serviceDate: "2026-02-10",
      serviceType: "Inspection",
      technicianName: "R. Karthik",
      description: "Battery health checked, firmware updated, and device cleaned.",
      nextServiceDue: "2026-08-10",
      status: "completed"
    },
    {
      id: "s-2",
      assetId: "a-2",
      serviceDate: "2026-05-24",
      serviceType: "Repair",
      technicianName: "S. Priya",
      description: "Paper jam diagnosed. Roller replacement required.",
      nextServiceDue: "2026-06-18",
      status: "pending"
    }
  ],
  appeals: [
    {
      id: "ap-1",
      assetId: "a-2",
      clientId: "c-1",
      assignedEngineerId: null,
      raisedBy: "u-client",
      title: "Printer paper feed issue",
      description: "Printer pulls multiple sheets during invoice printing.",
      priority: "high",
      status: "in_review",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-25T14:15:00.000Z"
    }
  ],
  appealMessages: [
    {
      id: "m-1",
      appealId: "ap-1",
      senderId: "u-client",
      message: "The issue started after the last toner replacement.",
      createdAt: "2026-05-24T10:05:00.000Z"
    },
    {
      id: "m-2",
      appealId: "ap-1",
      senderId: "u-admin",
      message: "Technician inspected the printer. Roller replacement is scheduled.",
      createdAt: "2026-05-25T14:15:00.000Z"
    }
  ]
};
