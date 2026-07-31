import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Certificates (TRN-07): earned on passing an assessment. The branded view
// prints to PDF via the browser (dedicated PDF service arrives with reports).
export default function Certificates() {
  const { company } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null);

  useEffect(() => {
    api
      .get('/certificates/mine')
      .then((response) => setRows(response.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [company?.id, toast]);

  const openCertificate = async (row) => {
    try {
      const response = await api.get(`/certificates/${row.id}`);
      setView(response.data.data);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">My Certificates</h2>
        <p className="page-subtitle">
          Earned by passing assessments. Open one to print or save as PDF.
        </p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Assessment</th>
                <th>Score</th>
                <th>Serial Number</th>
                <th>Issued</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="cell-wrap">{row.title}</td>
                    <td>{row.percentage}%</td>
                    <td>{row.serial}</td>
                    <td>{new Date(row.issuedAt).toLocaleDateString('en-GB')}</td>
                    <td className="col-action">
                      <Button variant="secondary" onClick={() => openCertificate(row)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(view)}
        title="Certificate"
        onClose={() => setView(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setView(null)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          </>
        }
      >
        {view && (
          <div className="certificate" id="certificate-print">
            <p className="certificate-company">{view.companyName}</p>
            <h2 className="certificate-heading">Certificate of Achievement</h2>
            <p className="certificate-text">This certifies that</p>
            <p className="certificate-name">{view.employeeName}</p>
            <p className="certificate-text">
              has successfully passed the assessment
              <br />
              <strong>{view.title}</strong> with a score of <strong>{view.percentage}%</strong>.
            </p>
            <div className="certificate-footer">
              <span>Issued on {new Date(view.issuedAt).toLocaleDateString('en-GB')}</span>
              <span>Serial: {view.serial}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
