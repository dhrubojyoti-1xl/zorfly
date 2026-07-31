# Team Branch Compatibility

Adds the optional direct branch relationship used by the OneXL team and
employee pickers. The relationship remains tenant-checked by repositories and
will receive a tenant-consistent composite foreign key in the RLS hardening
migration.

- Change class: compatible and additive.
- Existing teams remain valid with a null branch.
- Lock risk is limited to adding a nullable column, index, and foreign key.
