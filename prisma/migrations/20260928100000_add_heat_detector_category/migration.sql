-- Session 22, round 14: track Heat Detectors alongside Smoke Detectors for
-- the equipment-servicing outreach radar. Added as its own enum value
-- (rather than folding heat detectors into SMOKE_DETECTOR) so the Outreach
-- dashboard, Equipment records, and inspection logs report them correctly
-- instead of mislabeling a heat detector as a smoke detector.
ALTER TYPE "EquipmentCategory" ADD VALUE 'HEAT_DETECTOR';
