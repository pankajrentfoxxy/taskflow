import { Patient, Visit, Prescription, Document } from '../models/index.js';

// Authorization is now clinic-scoped: any signed-in doctor in the same clinic
// can read/write any patient/visit/document/etc. owned by that clinic.

export const ensurePatient = async (req, res, next) => {
  const patient = await Patient.findByPk(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Patient not found' });
  if (patient.clinic_id !== req.user?.clinic_id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.patient = patient;
  next();
};

export const ensureVisit = async (req, res, next) => {
  const visit = await Visit.findByPk(req.params.visitId || req.params.id);
  if (!visit) return res.status(404).json({ message: 'Visit not found' });
  if (visit.clinic_id !== req.user?.clinic_id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.visit = visit;
  next();
};

export const ensurePrescription = async (req, res, next) => {
  const presc = await Prescription.findByPk(req.params.id);
  if (!presc) return res.status(404).json({ message: 'Prescription not found' });
  const visit = await Visit.findByPk(presc.visit_id);
  if (!visit || visit.clinic_id !== req.user?.clinic_id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.prescription = presc;
  req.visit = visit;
  next();
};

export const ensureReport = async (req, res, next) => {
  // Reports live in the unified `documents` table (owner_type='patient').
  const doc = await Document.findByPk(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Report not found' });
  if (doc.owner_type !== 'patient') {
    return res.status(404).json({ message: 'Report not found' });
  }
  const patient = await Patient.findByPk(doc.owner_id);
  if (!patient || patient.clinic_id !== req.user?.clinic_id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.report = doc;
  req.patient = patient;
  next();
};

// Generic ownership check for any document — verifies the document belongs
// to the same clinic as the requester.
export const ensureDocument = async (req, res, next) => {
  const doc = await Document.findByPk(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.clinic_id !== req.user?.clinic_id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  req.document = doc;
  next();
};

// Reusable guard for clinic-owner-only endpoints (invite/remove doctors,
// edit clinic info). Mount AFTER auth() so req.user is populated.
export const requireClinicOwner = (req, res, next) => {
  if (!req.user?.is_clinic_owner) {
    return res.status(403).json({ message: 'Clinic owner only' });
  }
  next();
};
