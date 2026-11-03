import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. ENUM TYPES SESUAI SPESIFIKASI ZIPBLIND
// ============================================================================

export const activityTypeEnum = pgEnum('activity_type_enum', [
  'Pemasangan',
  'Pengukuran',
  'Survey',
  'Perbaikan',
  'Service',
  'Pengiriman',
  'Pengambilan',
  'Lainnya',
]);

export const projectStatusEnum = pgEnum('project_status_enum', [
  'Dijadwalkan',
  'Sedang Berjalan',
  'Selesai',
  'Tertunda',
  'Dibatalkan',
]);

export const activityStatusEnum = pgEnum('activity_status_enum', [
  'Dijadwalkan',
  'Sedang Berjalan',
  'Selesai',
  'Tertunda',
  'Dibatalkan',
]);

export const photoCategoryEnum = pgEnum('photo_category_enum', [
  'Sebelum Pemasangan',
  'Proses Pekerjaan',
  'Hasil Akhir',
  'Lainnya',
]);

// ============================================================================
// 2. TABEL UTAMA (14 ENTITAS SESUAI SPESIFIKASI PROMPT 2)
// ============================================================================

// 1. ADMINS
export const admins = pgTable('admins', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 160 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. TECHNICIANS
export const technicians = pgTable('technicians', {
  id: uuid('id').defaultRandom().primaryKey(),
  technicianCode: varchar('technician_code', { length: 30 }).notNull().unique(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  specialization: varchar('specialization', { length: 120 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. CUSTOMERS
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerCode: varchar('customer_code', { length: 30 }).notNull().unique(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  contactPerson: varchar('contact_person', { length: 120 }),
  phone: varchar('phone', { length: 30 }).notNull(),
  email: varchar('email', { length: 160 }),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. PROJECTS (Status proyek terpisah dari status aktivitas)
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectCode: varchar('project_code', { length: 40 }).notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 200 }).notNull(),
    installationAddress: text('installation_address').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('Dijadwalkan'),
    startDate: date('start_date'),
    targetEndDate: date('target_end_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => admins.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_projects_customer_id').on(table.customerId),
    index('idx_projects_status').on(table.status),
    check(
      'projects_date_check',
      sql`${table.targetEndDate} IS NULL OR ${table.startDate} IS NULL OR ${table.targetEndDate} >= ${table.startDate}`
    ),
  ]
);

// 5. PROJECT ACTIVITIES (Satu proyek dapat memiliki banyak aktivitas dengan status masing-masing)
export const projectActivities = pgTable(
  'project_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    activityCode: varchar('activity_code', { length: 40 }).notNull().unique(),
    activityType: activityTypeEnum('activity_type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    scheduledTimeSlot: varchar('scheduled_time_slot', { length: 50 }),
    status: activityStatusEnum('status').notNull().default('Dijadwalkan'),
    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => admins.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_activities_project_id').on(table.projectId),
    index('idx_project_activities_dates').on(table.startDate, table.endDate),
    index('idx_project_activities_status').on(table.status),
    check('project_activities_date_check', sql`${table.endDate} >= ${table.startDate}`),
  ]
);

// 6. ACTIVITY TECHNICIANS (Penugasan Teknisi — Satu aktivitas dapat memiliki beberapa teknisi)
export const activityTechnicians = pgTable(
  'activity_technicians',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => projectActivities.id, { onDelete: 'cascade' }),
    technicianId: uuid('technician_id')
      .notNull()
      .references(() => technicians.id, { onDelete: 'restrict' }),
    isLead: boolean('is_lead').notNull().default(false),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('activity_technicians_unique').on(table.activityId, table.technicianId),
    index('idx_activity_technicians_activity_id').on(table.activityId),
    index('idx_activity_technicians_technician_id').on(table.technicianId),
  ]
);

// 7. PRODUCT CATALOG (Roller Blind, Zipblind, Vertical Blind, Venetian Blind)
export const productCatalog = pgTable('product_catalog', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  unitLabel: varchar('unit_label', { length: 20 }).notNull().default('set'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. ACTIVITY WORK DETAILS (Detail pekerjaan dalam satuan set)
export const activityWorkDetails = pgTable(
  'activity_work_details',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => projectActivities.id, { onDelete: 'cascade' }),
    activityType: activityTypeEnum('activity_type').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => productCatalog.id, { onDelete: 'restrict' }),
    quantitySets: integer('quantity_sets').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_activity_work_details_activity_id').on(table.activityId),
    index('idx_activity_work_details_product_id').on(table.productId),
    check('activity_work_details_qty_check', sql`${table.quantitySets} > 0`),
  ]
);

// 9. STATUS CHANGE LOGS (Riwayat perubahan status proyek & aktivitas)
export const statusChangeLogs = pgTable(
  'status_change_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id').references(() => projectActivities.id, {
      onDelete: 'cascade',
    }),
    entityType: varchar('entity_type', { length: 20 }).notNull(),
    oldStatus: varchar('old_status', { length: 40 }),
    newStatus: varchar('new_status', { length: 40 }).notNull(),
    reasonNotes: text('reason_notes'),
    changedBy: uuid('changed_by').references(() => admins.id, { onDelete: 'set null' }),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_status_change_logs_project_id').on(table.projectId),
    check(
      'status_change_logs_entity_check',
      sql`${table.entityType} IN ('project', 'activity')`
    ),
  ]
);

// 10. PROJECT PHOTOS (Dokumentasi Foto — Opsional, tidak menghalangi penyelesaian pekerjaan)
export const projectPhotos = pgTable(
  'project_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    activityId: uuid('activity_id').references(() => projectActivities.id, {
      onDelete: 'set null',
    }),
    category: photoCategoryEnum('category').notNull().default('Hasil Akhir'),
    storageBucket: varchar('storage_bucket', { length: 80 })
      .notNull()
      .default('project-photos'),
    storagePath: text('storage_path').notNull().unique(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 80 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    caption: text('caption'),
    uploadedBy: uuid('uploaded_by').references(() => admins.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_photos_project_id').on(table.projectId),
    index('idx_project_photos_activity_id').on(table.activityId),
    check(
      'project_photos_size_check',
      sql`${table.fileSizeBytes} IS NULL OR ${table.fileSizeBytes} >= 0`
    ),
  ]
);

// 11. EXECUTIVE SECRET LINKS (Token disimpan dalam bentuk SHA-256 hash)
export const executiveSecretLinks = pgTable(
  'executive_secret_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    label: varchar('label', { length: 120 }).notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    tokenPrefix: varchar('token_prefix', { length: 12 }).notNull(),
    canDownloadReports: boolean('can_download_reports').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => admins.id, { onDelete: 'set null' }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => admins.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_executive_secret_links_hash').on(table.tokenHash)]
);

// 12. EXECUTIVE ACCESS LOGS (Log akses dashboard pimpinan)
export const executiveAccessLogs = pgTable(
  'executive_access_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    secretLinkId: uuid('secret_link_id')
      .notNull()
      .references(() => executiveSecretLinks.id, { onDelete: 'cascade' }),
    accessAction: varchar('access_action', { length: 40 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_executive_access_logs_link_id').on(table.secretLinkId),
    check(
      'executive_access_logs_action_check',
      sql`${table.accessAction} IN ('view_dashboard', 'download_pdf', 'download_excel')`
    ),
  ]
);

// 13. ADMIN ACTIVITY LOGS (Riwayat aktivitas admin)
export const adminActivityLogs = pgTable(
  'admin_activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    actionType: varchar('action_type', { length: 60 }).notNull(),
    entityName: varchar('entity_name', { length: 60 }).notNull(),
    entityId: uuid('entity_id'),
    description: text('description').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_admin_activity_logs_created_at').on(table.createdAt)]
);

// 14. REPORT EXPORT LOGS (Riwayat ekspor laporan PDF & Excel)
export const reportExportLogs = pgTable(
  'report_export_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportPeriodMonth: date('report_period_month').notNull(),
    reportTitle: varchar('report_title', { length: 160 }).notNull(),
    exportFormat: varchar('export_format', { length: 10 }).notNull(),
    exportedByRole: varchar('exported_by_role', { length: 20 }).notNull(),
    adminId: uuid('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    secretLinkId: uuid('secret_link_id').references(() => executiveSecretLinks.id, {
      onDelete: 'set null',
    }),
    fileStoragePath: text('file_storage_path'),
    exportedAt: timestamp('exported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_report_export_logs_period').on(table.reportPeriodMonth),
    check('report_export_logs_format_check', sql`${table.exportFormat} IN ('PDF', 'EXCEL')`),
    check(
      'report_export_logs_role_check',
      sql`${table.exportedByRole} IN ('admin', 'executive')`
    ),
  ]
);

// ============================================================================
// 3. DRIZZLE RELATIONS
// ============================================================================

export const customersRelations = relations(customers, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  customer: one(customers, {
    fields: [projects.customerId],
    references: [customers.id],
  }),
  createdByAdmin: one(admins, {
    fields: [projects.createdBy],
    references: [admins.id],
  }),
  activities: many(projectActivities),
  photos: many(projectPhotos),
  statusChangeLogs: many(statusChangeLogs),
}));

export const projectActivitiesRelations = relations(
  projectActivities,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectActivities.projectId],
      references: [projects.id],
    }),
    assignedTechnicians: many(activityTechnicians),
    workDetails: many(activityWorkDetails),
    photos: many(projectPhotos),
    statusChangeLogs: many(statusChangeLogs),
  })
);

export const techniciansRelations = relations(technicians, ({ many }) => ({
  activityAssignments: many(activityTechnicians),
}));

export const activityTechniciansRelations = relations(
  activityTechnicians,
  ({ one }) => ({
    activity: one(projectActivities, {
      fields: [activityTechnicians.activityId],
      references: [projectActivities.id],
    }),
    technician: one(technicians, {
      fields: [activityTechnicians.technicianId],
      references: [technicians.id],
    }),
  })
);

export const productCatalogRelations = relations(productCatalog, ({ many }) => ({
  workDetails: many(activityWorkDetails),
}));

export const activityWorkDetailsRelations = relations(
  activityWorkDetails,
  ({ one }) => ({
    activity: one(projectActivities, {
      fields: [activityWorkDetails.activityId],
      references: [projectActivities.id],
    }),
    product: one(productCatalog, {
      fields: [activityWorkDetails.productId],
      references: [productCatalog.id],
    }),
  })
);

export const projectPhotosRelations = relations(projectPhotos, ({ one }) => ({
  project: one(projects, {
    fields: [projectPhotos.projectId],
    references: [projects.id],
  }),
  activity: one(projectActivities, {
    fields: [projectPhotos.activityId],
    references: [projectActivities.id],
  }),
}));

export const executiveSecretLinksRelations = relations(
  executiveSecretLinks,
  ({ many }) => ({
    accessLogs: many(executiveAccessLogs),
    reportExportLogs: many(reportExportLogs),
  })
);

export const executiveAccessLogsRelations = relations(
  executiveAccessLogs,
  ({ one }) => ({
    secretLink: one(executiveSecretLinks, {
      fields: [executiveAccessLogs.secretLinkId],
      references: [executiveSecretLinks.id],
    }),
  })
);
