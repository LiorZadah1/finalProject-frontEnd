import React, { useState, useEffect } from 'react';
import { useMetaMask } from "metamask-react";
import { ethers } from 'ethers';
import { createContract } from '../utils/createContract';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Box,
  Card,
  CardContent
} from '@mui/material';
import { getGroupIdForUser } from '../utils/getGroupIdForUser';
import VotingSystem from "../../hardhat-tutorial/artifacts/contracts/VotingSystem.sol/VotingSystem.json";
import useCheckUser from '../utils/checkUser';
import useFetchUserDetails from '../hooks/useFetchUserDetails';

interface Vote {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: boolean;
}

const ParticipatedVotes: React.FC = () => {
  const { status, account, ethereum } = useMetaMask();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidUser, userLoading] = useCheckUser();
  const [userDetails, userDetailsLoading, userDetailsError] = useFetchUserDetails(account || '');

  useEffect(() => {
    const fetchContractDetails = async () => {
      if (status === "connected" && account && !userLoading && !userDetailsLoading) {
        try {
          let contractAddress: string | null = null;

          if (isValidUser) {
            const docRef = doc(db, 'voteManagers', account.toLowerCase());
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              contractAddress = docSnap.data().contractAddress;
            }
          } else if (userDetails) {
            contractAddress = userDetails.contractAddress;
          }

          if (contractAddress && ethereum) {
            const abi = VotingSystem.abi;
            const contractInstance = await createContract(ethereum, contractAddress, abi);
            setContract(contractInstance);
            console.log("Contract instance created successfully:", contractInstance);
          } else {
            throw new Error("Contract details not found!");
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error('Failed to load contract:', error.message);
            setError(error.message);
          } else {
            console.error('An unexpected error occurred');
            setError('An unexpected error occurred');
          }
        } finally {
          setLoading(false);
        }
      }
    };

    if (!userLoading && !userDetailsLoading) {
      fetchContractDetails();
    }
  }, [status, account, ethereum, isValidUser, userLoading, userDetails, userDetailsLoading]);

  useEffect(() => {
    const fetchVotes = async () => {
      if (contract && account) {
        try {
          const groupId = await getGroupIdForUser(account.toLowerCase());
          if (groupId === null) throw new Error("Group ID not found for the user");

          const result = await contract.getAccessibleVotes(groupId);
          console.log('Result from contract:', result);

          const [voteIDs, voteNames, startVoteTimes, durations, openStatuses] = result;

          const formattedVotes = voteIDs.map((voteID: ethers.BigNumberish, index: number) => {
            const startDate = new Date(Number(startVoteTimes[index]) * 1000);
            const endDate = new Date((Number(startVoteTimes[index]) + Number(durations[index])) * 1000);
            const currentTime = new Date();

            return {
              id: voteID.toString(),
              name: voteNames[index],
              startDate: startDate.toLocaleString(),
              endDate: endDate.toLocaleString(),
              status: openStatuses[index] && currentTime < endDate,
            };
          });

          setVotes(formattedVotes);
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error('Error fetching votes:', error.message);
            setError(error.message);
          } else {
            console.error('An unexpected error occurred');
            setError('An unexpected error occurred');
          }
        }
      }
    };

    fetchVotes();
  }, [contract, account]);

  if (loading || userLoading || userDetailsLoading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
          <CircularProgress />
          <Typography>Loading participated votes...</Typography>
        </Box>
      </Container>
    );
  }

  if (error || userDetailsError) {
    return (
      <Container>
        <Typography color="error">{error || userDetailsError}</Typography>
      </Container>
    );
  }

  return (
    <Container>
      <Card sx={{ borderRadius: 3, boxShadow: 3, backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
            Votes I've Participated In
          </Typography>
          {votes.length > 0 ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>Vote ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>Name</TableCell>
                    {/* <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>Start Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>End Date</TableCell> */}
                    <TableCell sx={{ fontWeight: 'bold', color: '#1976d2' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {votes.map((vote) => (
                    <TableRow key={vote.id}>
                      <TableCell>{vote.id}</TableCell>
                      <TableCell>{vote.name}</TableCell>
                      {/* <TableCell>{vote.startDate}</TableCell>
                      <TableCell>{vote.endDate}</TableCell> */}
                      <TableCell>{vote.status ? 'Open' : 'Closed'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body1" component="p">
              No votes participated in yet.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default ParticipatedVotes;
