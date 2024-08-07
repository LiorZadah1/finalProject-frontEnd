import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createContract } from '../utils/createContract';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { useMetaMask } from "metamask-react";
import VotingSystem from "../../hardhat-tutorial/artifacts/contracts/VotingSystem.sol/VotingSystem.json";
import { getCurrentVoteId, fetchAndUpdateVoteId, getUsersByGroupId } from '../utils/fetchAndUpdateVoteId';
import {
  Container,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Grid,
  Box,
  Card,
  CardContent,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
} from '@mui/material';

const CreateVote: React.FC = () => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [voteName, setVoteName] = useState('');
  const [startVoteTime, setStartVoteTime] = useState('');
  const [voteDuration, setVoteDuration] = useState('');
  const [groupId, setGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [voteOptions, setVoteOptions] = useState(['', '']); // Initialize with two empty options
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteId, setVoteId] = useState<number | null>(null); // State for vote ID
  const { status, account } = useMetaMask();

  useEffect(() => {
    async function fetchData() {
      try {
        if (status === "connected" && account) {
          const docRef = doc(db, 'voteManagers', account.toLowerCase()); // Ensure account is lowercase
          const docSnap = await getDoc(docRef);

          if (!docSnap.exists()) {
            throw new Error('No contract information available!');
          }

          const { contractAddress, group } = docSnap.data();
          const abi = VotingSystem.abi;
          if (window.ethereum) {
            const contractInstance = await createContract(window.ethereum, contractAddress, abi);
            setContract(contractInstance);

            // Fetch the current vote ID
            const currentVoteId = await getCurrentVoteId();
            setVoteId(currentVoteId);

            // Set available groups
            setAvailableGroups(Object.keys(group));
          } else {
            throw new Error('Ethereum object is not available.');
          }
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
        setIsLoading(false);
      }
    }

    fetchData();
  }, [status, account]);

  if (isLoading) {
    return (
      <Container>
        <CircularProgress />
        <Typography>Loading contract data...</Typography>
      </Container>
    );
  }

  if (!contract) {
    return (
      <Container>
        <Typography color="error">{error || 'Contract is not loaded.'}</Typography>
      </Container>
    );
  }

  const handleOptionChange = (index: number, value: string) => {
    const options = [...voteOptions];
    options[index] = value;
    setVoteOptions(options);
  };

  const addOption = () => {
    if (voteOptions.length < 10) {
      setVoteOptions([...voteOptions, '']);
    } else {
      setError('A maximum of 10 options are allowed.');
    }
  };

  const resetForm = () => {
    setVoteName('');
    setStartVoteTime('');
    setVoteDuration('');
    setGroupId('');
    setVoteOptions(['', '']); // Reset to two empty options
    //setVoteId(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!account) {
        throw new Error('Account is not available.');
      }

      alert("Please check your MetaMask extension :)")
      const startTime = BigInt(Date.parse(startVoteTime) / 1000);
      const duration = BigInt(voteDuration) * 24n * 60n * 60n; // Convert days to seconds
      const groupID = BigInt(groupId);
      const options = voteOptions.filter(option => option.trim() !== '');
      if (duration <= 0 || groupID <= 0 ) throw new Error('Duration and group ID must be a positive number.');

      // Increment and fetch the next vote ID
      const voteID = await fetchAndUpdateVoteId();
      setVoteId(voteID);

      const tx = await contract.createVote(voteID, voteName, startTime, duration, groupID, options);
      await tx.wait();
      console.log(tx);

      // Add to usersVotes collection
      const userVotesRef = doc(db, 'usersVotes', account.toLowerCase());
      await setDoc(userVotesRef, { votes: arrayUnion({ voteID, voteName }) }, { merge: true });

      alert(`Vote successfully created with ID: ${voteID}`);
      resetForm();

    // Now let's add all the users as voters
    try {
      const usersInGroup = await getUsersByGroupId(account.toLowerCase(), groupId);
      console.log(usersInGroup);
      
      // Filter and convert addresses to checksummed format
      const checksummedAddresses = usersInGroup
        .filter(addr => ethers.isAddress(addr)) // Validate addresses
        .map(addr => ethers.getAddress(addr)); // Convert to checksummed format
      
      if (checksummedAddresses.length === 0) {
        throw new Error('No valid addresses found in the group.');
      }

      console.log(checksummedAddresses);
      const txx = await contract.addVoters(voteID, checksummedAddresses, groupID);
      await txx.wait();
      console.log(txx);
    } catch (error) {
      console.error('Failed to add voters:', error);
      setError('Failed to add voters. Please check the addresses and try again.');
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Failed to create vote:', error.message);
      setError(error.message);
    } else {
      console.error('An unexpected error occurred');
      setError('An unexpected error occurred');
    }
  }
};

  const minStartDate = new Date().toISOString().slice(0, 16);

  return (
    <Container maxWidth="sm">
      <Box mt={4}>
        <Card sx={{ borderRadius: 3, boxShadow: 3, backgroundColor: 'rgba(173, 216, 230, 0.7)' }}>
          <CardContent>
            <Typography variant="h2" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              Create New Vote
            </Typography>
            <Typography variant="h6" component="h2" gutterBottom>
              {`Vote Identifier - ${voteId}`}
            </Typography>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Vote Name"
                    variant="outlined"
                    fullWidth
                    value={voteName}
                    onChange={(e) => setVoteName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Start Vote Time"
                    type="datetime-local"
                    variant="outlined"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: minStartDate }}
                    value={startVoteTime}
                    onChange={(e) => setStartVoteTime(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Vote Duration (days)"
                    type="number"
                    variant="outlined"
                    fullWidth
                    inputProps={{ min: "1" }} // Ensure duration can't be decreased below 1
                    value={voteDuration}
                    onChange={(e) => setVoteDuration(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl variant="outlined" fullWidth>
                    <InputLabel id="group-select-label">Group ID</InputLabel>
                    <Select
                      labelId="group-select-label"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value as string)}
                      label="Group ID"
                    >
                      {availableGroups.map((group) => (
                        <MenuItem key={group} value={group}>
                          {group}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {voteOptions.map((option, index) => (
                  <Grid item xs={12} key={index}>
                    <TextField
                      label={`Option ${index + 1}`}
                      variant="outlined"
                      fullWidth
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                    />
                  </Grid>
                ))}
                {voteOptions.length < 10 && (
                  <Grid item xs={12}>
                    <Button onClick={addOption} variant="contained" fullWidth>
                      Add Option
                    </Button>
                  </Grid>
                )}
                {error && (
                  <Grid item xs={12}>
                    <Typography color="error">{error}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Button type="submit" variant="contained" color="primary" fullWidth>
                    Create Vote
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default CreateVote;
